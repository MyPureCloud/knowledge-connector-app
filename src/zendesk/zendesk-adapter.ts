import { ZendeskCategory } from './model/zendesk-category.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { ZendeskArticleAttachment } from './model/zendest-article-attachment.js';
import { Image } from '../model/image.js';
import { ZendeskApi } from './zendesk-api.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import logger from '../utils/logger.js';

export class ZendeskAdapter
  implements
    SourceAdapter<ZendeskCategory, ZendeskLabel, ZendeskArticle>,
    ImageSourceAdapter
{
  private config: ZendeskConfig = {};
  private attachmentCache: { [key: string]: ZendeskArticleAttachment[] } = {};
  private api: ZendeskApi;

  constructor() {
    this.api = new ZendeskApi();
  }

  public initialize(config: ZendeskConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public getAllArticles(): Promise<ZendeskArticle[]> {
    return this.api.fetchAllArticles();
  }

  public getAllCategories(): Promise<ZendeskSection[]> {
    return this.api.fetchAllCategories();
  }

  public getAllLabels(): Promise<ZendeskLabel[]> {
    return this.api.fetchAllLabels();
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (!articleId) {
      return null;
    }

    const info = await this.getAttachmentInfo(articleId, url);

    if (!info) {
      logger.warn(`Cannot find attachment [${url}] for article [${articleId}]`);
      return null;
    }

    const content = await this.api.downloadAttachment(url);

    return {
      url,
      name: info.file_name,
      contentType: info.content_type,
      content,
    };
  }

  private async getAttachmentInfo(
    articleId: string,
    contentUrl: string,
  ): Promise<ZendeskArticleAttachment | undefined> {
    if (!this.attachmentCache[articleId]) {
      this.attachmentCache[articleId] =
        await this.api.fetchAttachmentInfoListForArticle(articleId);
    }
    return this.attachmentCache[articleId].find(
      (item) => item.content_url.replace(/\/$/, '') === contentUrl,
    );
  }
}
