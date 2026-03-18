import {
  AuthenticationType,
  ServiceNowConfig,
} from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { fetchSourceResource } from '../utils/web-client.js';
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
import { validateNonNull } from '../utils/validate-non-null.js';
import { LANGUAGE_MAPPING } from './servicenow-language-mapping.js';
import { AuthenticationProvider } from '../utils/authentication/authentication-provider.js';
import { BasicAuthenticationProvider } from '../utils/authentication/basic-authentication-provider.js';
import { OauthPasswordAuthenticationProvider } from '../utils/authentication/oauth-password-authentication-provider.js';
import { ServiceNowTokenParser } from './servicenow-token-parser.js';
import { NopeAuthenticationProvider } from '../utils/authentication/nope-authentication-provider.js';
import { OauthClientCredentialsAuthenticationProvider } from '../utils/authentication/oauth-client-credentials-authentication-provider.js';
import { ServiceNowAccessTokenResponse } from './model/servicenow-access-token-response.js';

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
  private authenticationProvider: AuthenticationProvider<ServiceNowAccessTokenResponse> =
    new NopeAuthenticationProvider();

  public async initialize(
    config: ServiceNowConfig,
    context: ServiceNowContext,
  ): Promise<void> {
    this.config = config;
    this.limit = this.config.limit
      ? Number.parseInt(this.config.limit, 10)
      : 50;
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl ?? '');
    await this.initAuthenticationProvider(config);

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
    return fetchSourceResource(url, requestInit, EntityType.DOCUMENT);
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const requestInit = await this.buildRequestInit();
    return fetchSourceResource<Blob>(
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
    const json = await fetchSourceResource<ServiceNowSingleArticleResponse>(
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

    const json = await fetchSourceResource<ServiceNowArticleResponse>(
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

    const json = await fetchSourceResource<ServiceNowCategoryResponse>(
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
    return {
      headers: await this.authenticationProvider.constructHeaders(),
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
      const language = this.mapLanguageCode();
      params.push(`language=${esc(language)}`);
    }

    return params.join('&');
  }

  private mapLanguageCode(): string {
    const languageCode = this.config.servicenowLanguage!;

    return (
      LANGUAGE_MAPPING[languageCode] ??
      (languageCode.length > 2 ? languageCode.substring(0, 2) : languageCode)
    );
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
    return offset === null
      ? null
      : `${this.baseUrl}${endpoint}&offset=${offset}`;
  }

  private constructCategoryUrl(offset: number | null): string | null {
    const endpoint = `/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined&sysparm_limit=${this.limit}`;
    return offset === null
      ? null
      : `${this.baseUrl}${endpoint}&sysparm_offset=${offset}`;
  }

  private async initAuthenticationProvider(
    config: ServiceNowConfig,
  ): Promise<void> {
    const authenticationType =
      config.servicenowAuthenticationType ?? AuthenticationType.BASIC;
    const isOAuth = authenticationType === AuthenticationType.OAUTH;

    if (isOAuth) {
      if (!this.config.servicenowUsername && !this.config.servicenowPassword) {
        this.initClientCredentialsGrant();
      } else {
        this.initPasswordGrant();
      }
    } else {
      this.initBasicAuth();
    }

    await this.authenticationProvider.authenticate();
  }

  private initPasswordGrant(): void {
    const clientId = validateNonNull(
      this.config.servicenowClientId,
      'Missing SERVICENOW_CLIENT_ID from config',
    );
    const clientSecret = validateNonNull(
      this.config.servicenowClientSecret,
      'Missing SERVICENOW_CLIENT_SECRET from config',
    );
    const username = validateNonNull(
      this.config.servicenowUsername,
      'Missing SERVICENOW_USERNAME from config',
    );
    const password = validateNonNull(
      this.config.servicenowPassword,
      'Missing SERVICENOW_PASSWORD from config',
    );

    this.authenticationProvider = new OauthPasswordAuthenticationProvider(
      clientId,
      clientSecret,
      username,
      password,
      `${this.config.servicenowBaseUrl}/oauth_token.do`,
      new ServiceNowTokenParser(),
    );
  }

  private initClientCredentialsGrant(): void {
    const clientId = validateNonNull(
      this.config.servicenowClientId,
      'Missing SERVICENOW_CLIENT_ID from config',
    );
    const clientSecret = validateNonNull(
      this.config.servicenowClientSecret,
      'Missing SERVICENOW_CLIENT_SECRET from config',
    );

    this.authenticationProvider =
      new OauthClientCredentialsAuthenticationProvider(
        clientId,
        clientSecret,
        `${this.config.servicenowBaseUrl}/oauth_token.do`,
        new ServiceNowTokenParser(),
      );
  }

  private initBasicAuth(): void {
    const username = validateNonNull(
      this.config.servicenowUsername,
      'Missing SERVICENOW_USERNAME from config',
    );
    const password = validateNonNull(
      this.config.servicenowPassword,
      'Missing SERVICENOW_PASSWORD from config',
    );

    this.authenticationProvider = new BasicAuthenticationProvider(
      username,
      password,
    );
  }
}
