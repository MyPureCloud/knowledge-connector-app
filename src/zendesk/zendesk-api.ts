import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskEntityTypes } from './model/zendesk-entity-types.js';
import { ZendeskResponse } from './model/zendesk-response.js';
import { ZendeskArticleAttachment } from './model/zendest-article-attachment.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { fetch, Response } from '../utils/web-client.js';

export class ZendeskApi {
  private config: ZendeskConfig = {};

  public initialize(config: ZendeskConfig): Promise<void> {
    this.config = config;
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
    await this.verifyResponse(response, url);

    return await response.blob();
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
    return this.getPage(`${this.config.zendeskBaseUrl}${endpoint}`, property);
  }

  private async getPage<T>(
    url: string,
    property: ZendeskEntityTypes,
  ): Promise<T[]> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    const json = (await response.json()) as ZendeskResponse;
    let list = json[property] as T[];
    if (json.next_page) {
      const tail = await this.getPage<T>(json.next_page, property);
      list = list.concat(tail);
    }
    return list;
  }

  private buildHeaders() {
    return {
      Authorization:
        'Basic ' +
        Buffer.from(
          this.config.zendeskUsername + ':' + this.config.zendeskPassword,
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
