import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { fetch, Response } from '../utils/web-client.js';
import { ServiceNowResponse } from './model/servicenow-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';

export class ServiceNowApi {
  private config: ServiceNowConfig = {};
  private limit: number = 0;

  public async initialize(config: ServiceNowConfig): Promise<void> {
    this.config = config;
    this.limit = this.config.limit ? parseInt(this.config.limit, 10) : 50;
  }

  public async fetchAllArticles(): Promise<ServiceNowArticle[]> {
    return await this.getPage<ServiceNowArticle>(
      `/api/sn_km_api/knowledge/articles?fields=category,text,workflow_state,topic&limit=${this.limit}`,
    );
  }

  private async getPage<T>(endpoint: string): Promise<ServiceNowArticle[]> {
    const url = `${this.config.servicenowBaseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    const json = (await response.json()) as ServiceNowResponse;
    const end = json.result.meta.end;
    let list = json.result.articles as ServiceNowArticle[];

    if (json.result.meta.count > end) {
      const nextUrl = `/api/sn_km_api/knowledge/articles?fields=category,text,workflow_state,topic&limit=${this.limit}&offset=${end}`;
      const tail = await this.getPage<T>(nextUrl);
      list = list.concat(tail);
    }

    return list;
  }

  public async fetchAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment> {
    const url = `${this.config.servicenowBaseUrl}/api/now/attachment/${attachmentId}`;
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

  private async verifyResponse(response: Response, url: string): Promise<void> {
    if (!response.ok) {
      const message = JSON.stringify(await response.json());
      throw new Error(
        `Api request [${url}] failed with status [${response.status}] and message [${message}]`,
      );
    }
  }
}
