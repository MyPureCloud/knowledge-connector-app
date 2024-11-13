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

  public async *articleIterator(): AsyncGenerator<ZendeskArticle, void, void> {
    yield* this.getPage<ZendeskArticle>(
      `/api/v2/help_center/${this.config.zendeskLocale}/articles`,
      ZendeskEntityTypes.ARTICLES,
    );
  }

  public async *categoryIterator(): AsyncGenerator<ZendeskSection, void, void> {
    yield* this.getPage<ZendeskSection>(
      `/api/v2/help_center/${this.config.zendeskLocale}/categories`,
      ZendeskEntityTypes.CATEGORIES,
    );
    yield* this.getPage<ZendeskSection>(
      `/api/v2/help_center/${this.config.zendeskLocale}/sections`,
      ZendeskEntityTypes.SECTIONS,
    );
  }

  public async *labelIterator(): AsyncGenerator<ZendeskLabel, void, void> {
    yield* this.getPage<ZendeskLabel>(
      `/api/v2/help_center/articles/labels`,
      ZendeskEntityTypes.LABELS,
    );
  }

  public async *attachmentInfoListForArticleIterator(
    articleId: string,
  ): AsyncGenerator<ZendeskArticleAttachment, void, void> {
    yield* this.getPage<ZendeskArticleAttachment>(
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

  private async *getPage<T>(
    endpoint: string,
    property: ZendeskEntityTypes,
  ): AsyncGenerator<T, void, void> {
    const headers = this.buildHeaders();
    let url: string | null = `${this.baseUrl}${endpoint}`;

    while (url) {
      const response = await fetch(url, {
        headers,
      });

      const json: ZendeskResponse = await readResponse<ZendeskResponse>(
        url,
        response,
      );
      const list = json[property] as T[];

      for (const item of list) {
        yield item;
      }

      url = json.next_page ? `${json.next_page}` : null;
    }
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
