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
    },
  };
  private bearerToken: string = '';
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
      this.bearerToken = await this.authenticate();
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

    this.apiContext.articles.done = true;
  }

  public async fetchAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment> {
    const url = `${this.baseUrl}/api/now/attachment/${attachmentId}`;
    return fetchResource(url, this.buildRequestInit(), EntityType.DOCUMENT);
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    return fetchResource<Blob>(
      url,
      this.buildRequestInit(),
      EntityType.DOCUMENT,
      ContentType.BLOB,
    );
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  public async getArticle(id: string): Promise<ServiceNowSingleArticle | null> {
    const url = `${this.baseUrl}/api/sn_km_api/knowledge/articles/${id}`;
    const json = await fetchResource<ServiceNowSingleArticleResponse>(
      url,
      this.buildRequestInit(),
      EntityType.DOCUMENT,
    );

    if (!json.result?.number) {
      // Article not found
      return null;
    }

    return json.result;
  }

  private async fetchNextArticlePage(): Promise<ServiceNowArticle[] | null> {
    const url: string | null = this.constructArticleUrl(
      this.apiContext.articles.nextOffset,
    );
    if (!url) {
      return null;
    }

    const json = await fetchResource<ServiceNowArticleResponse>(
      url,
      this.buildRequestInit(),
      EntityType.DOCUMENT,
    );

    const list = json.result.articles;

    getLogger().debug(
      `fetchNextArticlePage - count: ${json.result.meta.count}, end: ${json.result.meta.end}`,
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

    const json = await fetchResource<ServiceNowCategoryResponse>(
      url,
      this.buildRequestInit(),
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

  private buildRequestInit(): RequestInit {
    if (this.isOAuth && this.bearerToken) {
      return {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
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

  private async authenticate(): Promise<string> {
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

      return data.access_token;
    } catch (error) {
      return await catcher<string>()
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
