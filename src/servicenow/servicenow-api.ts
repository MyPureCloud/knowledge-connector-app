import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import {
  fetch,
  readResponse,
  verifyResponseStatus,
} from '../utils/web-client.js';
import { ServiceNowResponse } from './model/servicenow-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';

export class ServiceNowApi {
  private config: ServiceNowConfig = {};
  private limit: number = 0;
  private baseUrl: string = '';

  public async initialize(config: ServiceNowConfig): Promise<void> {
    this.config = config;
    this.limit = this.config.limit ? parseInt(this.config.limit, 10) : 50;
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  public async fetchAllArticles(): Promise<ServiceNowArticle[]> {
    return await this.getPage<ServiceNowArticle>(
      `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&limit=${this.limit}`,
    );
  }

  private async getPage<T>(endpoint: string): Promise<ServiceNowArticle[]> {
    const url = this.buildUrl(`${this.baseUrl}${endpoint}`);
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    const json = await readResponse<ServiceNowResponse>(url, response);
    const end = json.result.meta.end;
    let list = json.result.articles;

    if (json.result.meta.count > end) {
      const nextUrl = `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&limit=${this.limit}&offset=${end}`;
      const tail = await this.getPage<T>(nextUrl);
      list = list.concat(tail);
    }

    return list;
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
    return removeTrailingSlash(this.config.relativeLinkBaseUrl || this.config.servicenowBaseUrl || '');
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

  private buildUrl(baseUrl: string): string {
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

    if (params.length > 0) {
      baseUrl += '&' + params.join('&');
    }

    return baseUrl;
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
