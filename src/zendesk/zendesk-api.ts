import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskEntityTypes } from './model/zendesk-entity-types.js';
import { ZendeskResponse } from './model/zendesk-response.js';
import { ZendeskArticleAttachment } from './model/zendest-article-attachment.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import {
  fetch,
  HeadersInit,
  readResponse,
  verifyResponseStatus,
} from '../utils/web-client.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';

export class ZendeskApi {
  private config: ZendeskConfig = {};
  private baseUrl: string = '';

  public initialize(config: ZendeskConfig): Promise<void> {
    this.config = config;
    this.baseUrl = removeTrailingSlash(config.zendeskBaseUrl || '');
    return Promise.resolve(undefined);
  }

  public fetchAllArticles(): Promise<ZendeskArticle[]> {
    return this.get<ZendeskArticle>(
      `/api/v2/help_center/${this.config.zendeskLocale}/articles`,
      ZendeskEntityTypes.ARTICLES,
    );
  }

  public async fetchAllCategories(): Promise<ZendeskSection[]> {
    const [categories, sections] = await Promise.all([
      this.fetchCategories(),
      this.fetchSections(),
    ]);
    return categories.concat(sections);
  }

  public fetchAllLabels(): Promise<ZendeskLabel[]> {
    return this.get<ZendeskLabel>(
      `/api/v2/help_center/articles/labels`,
      ZendeskEntityTypes.LABELS,
    );
  }

  public fetchAttachmentInfoListForArticle(
    articleId: string,
  ): Promise<ZendeskArticleAttachment[]> {
    return this.get<ZendeskArticleAttachment>(
      `/api/v2/help_center/${this.config.zendeskLocale}/articles/${articleId}/attachments/inline`,
      ZendeskEntityTypes.ARTICLE_ATTACHMENTS,
    );
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await verifyResponseStatus(url, response);

    return await response.blob();
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.zendeskBaseUrl || '');
  }

  private fetchCategories(): Promise<ZendeskSection[]> {
    return this.get<ZendeskSection>(
      `/api/v2/help_center/${this.config.zendeskLocale}/categories`,
      ZendeskEntityTypes.CATEGORIES,
    );
  }

  private fetchSections(): Promise<ZendeskSection[]> {
    return this.get<ZendeskSection>(
      `/api/v2/help_center/${this.config.zendeskLocale}/sections`,
      ZendeskEntityTypes.SECTIONS,
    );
  }

  private get<T>(endpoint: string, property: ZendeskEntityTypes): Promise<T[]> {
    return this.getPage(`${this.baseUrl}${endpoint}`, property);
  }

  private async getPage<T>(
    url: string,
    property: ZendeskEntityTypes,
  ): Promise<T[]> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    const json = await readResponse<ZendeskResponse>(url, response);
    let list = json[property] as T[];
    if (json.next_page) {
      const tail = await this.getPage<T>(json.next_page, property);
      list = list.concat(tail);
    }
    return list;
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization:
        'Basic ' +
        Buffer.from(
          this.config.zendeskUsername + ':' + this.config.zendeskPassword,
          'utf-8',
        ).toString('base64'),
    };
  }
}
