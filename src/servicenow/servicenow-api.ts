import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import {
  fetch,
  readResponse,
  verifyResponseStatus,
} from '../utils/web-client.js';
import { ServiceNowArticleResponse } from './model/servicenow-article-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowCategoryResponse } from './model/servicenow-category-response.js';

export class ServiceNowApi {
  private config: ServiceNowConfig = {};
  private limit: number = 0;
  private baseUrl: string = '';

  public async initialize(config: ServiceNowConfig): Promise<void> {
    this.config = config;
    this.limit = this.config.limit ? parseInt(this.config.limit, 10) : 50;
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  public async *categoryIterator(): AsyncGenerator<
    ServiceNowCategory,
    void,
    void
  > {
    yield* this.getCategoryPage(
      `/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined&sysparm_limit=${this.limit}`,
      'sysparm_offset',
    );
  }

  public async *articleIterator(): AsyncGenerator<
    ServiceNowArticle,
    void,
    void
  > {
    yield* this.getArticlePage(
      `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&${this.queryParams()}&limit=${this.limit}`,
      'offset',
    );
  }

  private async *getArticlePage(
    endpoint: string,
    offsetParam: string,
  ): AsyncGenerator<ServiceNowArticle, void, void> {
    let url: string | null = `${this.baseUrl}${endpoint}&${offsetParam}=0`;

    while (url) {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      const json: ServiceNowArticleResponse =
        await readResponse<ServiceNowArticleResponse>(url, response);
      const list = json.result.articles;

      for (const item of list) {
        yield item;
      }

      url =
        json.result.meta.count > json.result.meta.end
          ? `${this.baseUrl}${endpoint}&${offsetParam}=${json.result.meta.end}`
          : null;
    }
  }

  private async *getCategoryPage(
    endpoint: string,
    offsetParam: string,
  ): AsyncGenerator<ServiceNowCategory, void, void> {
    let offset: number | null = 0;
    let url: string | null =
      `${this.baseUrl}${endpoint}&${offsetParam}=${offset}`;

    while (url && offset !== null) {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      const json: ServiceNowCategoryResponse =
        await readResponse<ServiceNowCategoryResponse>(url, response);
      const list = json.result;

      for (const item of list) {
        yield item;
      }

      offset = list.length > 0 ? offset + list.length : null;
      url = offset
        ? `${this.baseUrl}${endpoint}&${offsetParam}=${offset}`
        : null;
    }
  }

  public async fetchAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment> {
    const url = `${this.baseUrl}/api/now/attachment/${attachmentId}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    return readResponse<ServiceNowArticleAttachment>(url, response);
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await verifyResponseStatus(url, response);

    return await response.blob();
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  private buildHeaders() {
    return {
      Authorization:
        'Basic ' +
        Buffer.from(
          this.config.servicenowUsername + ':' + this.config.servicenowPassword,
          'utf-8',
        ).toString('base64'),
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
}
