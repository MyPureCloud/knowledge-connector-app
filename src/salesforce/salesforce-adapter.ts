import { SalesforceCategory } from './model/salesforce-category.js';
import { SalesforceLabel } from './model/salesforce-label.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceSection } from './model/salesforce-section.js';
import { SalesforceArticleAttachment } from './model/salesforce-article-attachment.js';
import { Image } from '../model/image.js';
import { SalesforceApi } from './salesforce-api.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import logger from '../utils/logger.js';
import { SalesforceIndividualArticle } from './model/salesforce-individual-article.js';

export class SalesforceAdapter
  implements
    SourceAdapter<SalesforceCategory, SalesforceLabel, SalesforceArticle>,
    ImageSourceAdapter
{
  private config: SalesforceConfig = {};
  private attachmentCache: { [key: string]: SalesforceArticleAttachment[] } = {};
  private api: SalesforceApi;

  constructor() {
    this.api = new SalesforceApi();
  }

  public initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public getAllArticles(): Promise<SalesforceArticle[]> {
    return this.api.fetchAllArticles();
  }

  public getArticle(articleId: string): Promise<SalesforceIndividualArticle[]> {
    return this.api.fetchArticle(articleId);
  }

  public getAllCategories(): Promise<SalesforceSection[]> {
    return this.api.fetchAllCategories();
  }

  public getAllLabels(): Promise<SalesforceLabel[]> {
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
  ): Promise<SalesforceArticleAttachment | undefined> {
    if (!this.attachmentCache[articleId]) {
      this.attachmentCache[articleId] =
        await this.api.fetchAttachmentInfoListForArticle(articleId);
    }
    return this.attachmentCache[articleId].find((item) =>
      item.content_url.startsWith(contentUrl),
    );
  }
}
