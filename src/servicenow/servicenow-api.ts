import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { fetch, Response } from '../utils/web-client.js';
import { ServiceNowResponse } from './model/servicenow-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { ApiError } from '../adapter/errors/api-error.js';
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
    await this.verifyResponse(response, url);

    const json = (await response.json()) as ServiceNowResponse;
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
    await this.verifyResponse(response, url);

    return (await response.json()) as ServiceNowArticleAttachment;
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    return await response.blob();
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
    const params: string[] = [];
    const esc = encodeURIComponent;

    if (this.config.servicenowKnowledgeBases) {
      params.push(`kb=${esc(this.config.servicenowKnowledgeBases)}`);
    }

    if (this.config.servicenowCategories) {
      params.push(
        `filter=${esc(this.buildCategoriesFilter(this.config.servicenowCategories))}`,
      );
    }

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

  private buildCategoriesFilter(value: string): string {
    const filters = value.split(',');

    return filters
      .map((f) => f.trim())
      .map((f) => `kb_category=${f}`)
      .join('^OR');
  }

  private async verifyResponse(response: Response, url: string): Promise<void> {
    if (!response.ok) {
      const message = JSON.stringify(await response.json());
      throw new ApiError(
        `Api request [${url}] failed with status [${response.status}] and message [${message}]`,
        { url, status: response.status, message },
      );
    }
  }
}
