import { AuthenticationType, ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { fetchResource } from '../utils/web-client.js';
import { ServiceNowArticleResponse } from './model/servicenow-article-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowCategoryResponse } from './model/servicenow-category-response.js';
import {
  ServiceNowApiContext,
  ServiceNowContext,
} from './model/servicenow-context.js';
import { setIfMissing } from '../utils/objects.js';
import { Pager } from '../utils/pager.js';
import { getLogger } from '../utils/logger.js';
import {
  ServiceNowSingleArticle,
  ServiceNowSingleArticleResponse,
} from './model/servicenow-single-article-response.js';
import { EntityType } from '../model/entity-type.js';
import { ContentType } from '../utils/content-type.js';
import { RequestInit } from 'undici';
import { validateNonNull} from '../utils/validate-non-null.js';
import { URLSearchParams} from 'url';
import { ServiceNowAccessTokenResponse} from '../servicenow/model/servicenow-access-token-response.js';
import { catcher } from '../utils/catch-error-helper.js';
import { Interrupted } from '../utils/errors/interrupted.js';
import { ApiError } from '../adapter/errors/api-error.js';
import { InvalidCredentialsError } from '../adapter/errors/invalid-credentials-error.js';
import { ServicenowOAuthToken } from './model/servicenow-oauth-token.js';

export class ServiceNowApi {
  private config: ServiceNowConfig = {};
  private limit: number = 0;
  private baseUrl: string = '';
  private apiContext: ServiceNowApiContext = {
    categories: {
      done: false,
      nextOffset: 0,
      unprocessed: [],
    },
    articles: {
      done: false,
      nextOffset: 0,
      unprocessed: [],
      processedCount: 0,
    },
  };
  private oAuthToken: ServicenowOAuthToken = {
    bearerToken : '',
    refreshToken: '',
    expiresAt: 0
  };
  private authenticationType?: AuthenticationType;
  private isOAuth: boolean = false;

  public async initialize(
    config: ServiceNowConfig,
    context: ServiceNowContext,
  ): Promise<void> {
    this.config = config;
    this.limit = this.config.limit ? parseInt(this.config.limit, 10) : 50;
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl ?? '');
    this.authenticationType = config.servicenowAuthenticationType ?? AuthenticationType.BASIC;
    this.isOAuth = this.authenticationType === AuthenticationType.OAUTH;
    if (this.isOAuth) {
      await this.authenticate();
    }

    this.apiContext = setIfMissing(context, 'api', this.apiContext);
  }

  public async *categoryIterator(): AsyncGenerator<
    ServiceNowCategory,
    void,
    void
  > {
    if (this.apiContext.categories.done) {
      return;
    }

    const pager = new Pager(this.apiContext.categories.unprocessed, () =>
      this.fetchNextCategoryPage(),
    );

    for await (const item of pager.fetch()) {
      yield item;
    }

    this.apiContext.categories.done = true;
  }

  public async *articleIterator(): AsyncGenerator<
    ServiceNowArticle,
    void,
    void
  > {
    if (this.apiContext.articles.done) {
      return;
    }

    const pager = new Pager(this.apiContext.articles.unprocessed, () =>
      this.fetchNextArticlePage(),
    );

    for await (const item of pager.fetch()) {
      yield item;
    }

    getLogger().info(
      `fetchNextArticlePage finished - processedCount: ${this.apiContext.articles.processedCount}`,
    );

    this.apiContext.articles.done = true;
  }

  public async fetchAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment> {
    const url = `${this.baseUrl}/api/now/attachment/${attachmentId}`;
    const requestInit = await this.buildRequestInit();
    return fetchResource(url, requestInit, EntityType.DOCUMENT);
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const requestInit = await this.buildRequestInit();
    return fetchResource<Blob>(
      url,
      requestInit,
      EntityType.DOCUMENT,
      ContentType.BLOB,
    );
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  public async getArticle(id: string): Promise<ServiceNowSingleArticle | null> {
    const url = `${this.baseUrl}/api/sn_km_api/knowledge/articles/${id}?fields=kb_category,kb_knowledge_base,workflow_state,active,sys_updated_on,valid_to`;
    const requestInit = await this.buildRequestInit();
    const json = await fetchResource<ServiceNowSingleArticleResponse>(
      url,
      requestInit,
      EntityType.DOCUMENT,
    );

    if (!json.result?.number) {
      getLogger().info(`Single article not found with ID ${id}`);
      return null;
    }

    const {
      sys_id,
      number,
      fields: {
        kb_category: { value: kb_category } = {},
        kb_knowledge_base: { value: kb_knowledge_base } = {},
        workflow_state: { value: workflow_state } = {},
        sys_updated_on: { value: sys_updated_on } = {},
        active: { value: active } = {},
        valid_to: { value: valid_to } = {},
      } = {},
    } = json.result;
    getLogger().info(
      `Single article successfully fetched with ID ${id}: ${JSON.stringify({
        sys_id,
        number,
        kb_category,
        kb_knowledge_base,
        workflow_state,
        sys_updated_on,
        active,
        valid_to,
      })}`,
    );

    return json.result;
  }

  private async fetchNextArticlePage(): Promise<ServiceNowArticle[] | null> {
    const url: string | null = this.constructArticleUrl(
      this.apiContext.articles.nextOffset,
    );
    if (!url) {
      return null;
    }

    const requestInit = await this.buildRequestInit();

    const json = await fetchResource<ServiceNowArticleResponse>(
      url,
      requestInit,
      EntityType.DOCUMENT,
    );

    const list = json.result.articles;
    this.apiContext.articles.processedCount += list?.length || 0;

    getLogger().info(
      `fetchNextArticlePage - count: ${json.result.meta.count}, end: ${json.result.meta.end}, processedCount: ${this.apiContext.articles.processedCount}`,
    );
    this.apiContext.articles.nextOffset =
      json.result.meta.count > json.result.meta.end
        ? json.result.meta.end
        : null;

    return list;
  }

  private async fetchNextCategoryPage(): Promise<ServiceNowCategory[] | null> {
    const url: string | null = this.constructCategoryUrl(
      this.apiContext.categories.nextOffset,
    );
    if (!url) {
      return null;
    }

    const requestInit = await this.buildRequestInit();

    const json = await fetchResource<ServiceNowCategoryResponse>(
      url,
      requestInit,
      EntityType.CATEGORY,
    );

    const list = json.result;

    getLogger().debug(
      `fetchNextCategoryPage - offset: ${this.apiContext.categories.nextOffset}`,
    );
    this.apiContext.categories.nextOffset =
      list.length > 0
        ? this.apiContext.categories.nextOffset! + list.length
        : null;

    return list;
  }

  private async buildRequestInit(): Promise<RequestInit> {
    if (this.isOAuth && this.oAuthToken.bearerToken) {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      return {
        headers: {
          Authorization: `Bearer ${this.oAuthToken.bearerToken}`,
        },
      };
    }

    return {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            this.config.servicenowUsername +
              ':' +
              this.config.servicenowPassword,
            'utf-8',
          ).toString('base64'),
      },
    };
  }

  private queryParams(): string {
    const esc = encodeURIComponent;
    const params: string[] = [];

    if (this.config.servicenowKnowledgeBases) {
      params.push(`kb=${esc(this.config.servicenowKnowledgeBases)}`);
    }

    params.push(
      `filter=${esc(this.buildFilters(this.config.servicenowCategories))}`,
    );

    if (this.config.servicenowLanguage) {
      const language =
        this.config.servicenowLanguage.length > 2
          ? this.config.servicenowLanguage.substring(0, 2)
          : this.config.servicenowLanguage;

      params.push(`language=${esc(language)}`);
    }

    return params.join('&');
  }

  private buildFilters(categories?: string): string {
    const filters: string[] = [];
    filters.push('workflow_state=published');

    if (categories) {
      filters.push(this.buildCategoriesFilter(categories));
    }
    filters.push('ORDERBYnumber');

    return filters.join('^');
  }

  private buildCategoriesFilter(value: string): string {
    const filters = value.split(',');

    return filters
      .map((f) => f.trim())
      .map((f) => `kb_category=${f}`)
      .join('^OR');
  }

  private constructArticleUrl(offset: number | null): string | null {
    const endpoint = `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category,sys_updated_on&${this.queryParams()}&limit=${this.limit}`;
    return offset !== null
      ? `${this.baseUrl}${endpoint}&offset=${offset}`
      : null;
  }

  private constructCategoryUrl(offset: number | null): string | null {
    const endpoint = `/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined&sysparm_limit=${this.limit}`;
    return offset !== null
      ? `${this.baseUrl}${endpoint}&sysparm_offset=${offset}`
      : null;
  }

  private isTokenExpired(): boolean {
    return Date.now() >= this.oAuthToken.expiresAt;
  }

  private async refreshAccessToken(): Promise<void> {
    validateNonNull(
      this.config.servicenowClientId,
      'Missing SERVICENOW_CLIENT_ID from config',
    );
    validateNonNull(
      this.config.servicenowClientSecret,
      'Missing SERVICENOW_CLIENT_SECRET from config',
    );
    validateNonNull(
      this.oAuthToken.refreshToken,
      'Missing refresh token from the previous access token',
    );

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'refresh_token');
    bodyParams.append('client_id', this.config.servicenowClientId!);
    bodyParams.append('client_secret', this.config.servicenowClientSecret!);
    bodyParams.append('refresh_token', this.oAuthToken.refreshToken);

    await this.getAccessToken(bodyParams);
  }

  private async authenticate(): Promise<void> {
    validateNonNull(
      this.config.servicenowClientId,
      'Missing SERVICENOW_CLIENT_ID from config',
    );
    validateNonNull(
      this.config.servicenowClientSecret,
      'Missing SERVICENOW_CLIENT_SECRET from config',
    );
    validateNonNull(
      this.config.servicenowUsername,
      'Missing SERVICENOW_USERNAME from config',
    );
    validateNonNull(
      this.config.servicenowPassword,
      'Missing SERVICENOW_PASSWORD from config',
    );

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', this.config.servicenowClientId!);
    bodyParams.append('client_secret', this.config.servicenowClientSecret!);
    bodyParams.append('username', this.config.servicenowUsername!);
    bodyParams.append('password', this.config.servicenowPassword!);

    await this.getAccessToken(bodyParams);
  }

  private async getAccessToken(bodyParams: URLSearchParams): Promise<void> {
    const url = `${this.baseUrl}/oauth_token.do`;
    const request = {
      method: 'POST',
      body: bodyParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const data = await fetchResource<ServiceNowAccessTokenResponse>(
        url,
        request,
        undefined,
      );

      validateNonNull(
        data.access_token,
        `Access token not found in the response: ${JSON.stringify(data)}`,
      );

      this.oAuthToken = {
        bearerToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000
      }
    } catch (error) {
      await catcher<void>()
        .on(ApiError, (apiError) => {
          throw InvalidCredentialsError.fromApiError(
            `Failed to get ServiceNow bearer token. Reason: ${apiError.message}`,
            apiError as ApiError,
          );
        })
        .rethrow(Interrupted)
        .any(() => {
          throw new InvalidCredentialsError(
            `Failed to get ServiceNow bearer token. Reason: ${error}`,
            { messageParams: { message: error } },
          );
        })
        .with(error);
    }
  }
}
