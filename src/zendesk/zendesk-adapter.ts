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
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';

export class ZendeskAdapter
  implements
    SourceAdapter<ZendeskCategory, ZendeskLabel, ZendeskArticle>,
    ImageSourceAdapter
{
  private config: ZendeskConfig = {};
  private attachmentCache: { [key: string]: ZendeskArticleAttachment[] } = {};
  private attachmentDomainValidator?: AttachmentDomainValidator;
  private api: ZendeskApi;

  constructor() {
    this.api = new ZendeskApi();
  }

  public initialize(config: ZendeskConfig): Promise<void> {
    this.config = config;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
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

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return undefined;
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
      getLogger().debug(
        `No attachment found with url [${url}] for article [${articleId}]`,
      );
      return null;
    }

    if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
      throw new AttachmentDomainNotAllowedError(url);
    }
    const content = await this.api.downloadAttachment(url);

    return {
      url,
      name: info.file_name,
      contentType: info.content_type,
      content,
    };
  }

  public getResourceBaseUrl(): string {
    return this.api.getInstanceUrl();
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
      (item) =>
        item.content_url.startsWith(contentUrl) ||
        contentUrl.startsWith(item.content_url),
    );
  }
}
