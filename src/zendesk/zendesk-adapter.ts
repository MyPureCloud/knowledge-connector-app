import { ZendeskCategory } from './model/zendesk-category.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskArticleAttachment } from './model/zendest-article-attachment.js';
import { Image } from '../model/image.js';
import { ZendeskApi } from './zendesk-api.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { ZendeskContext } from './model/zendesk-context.js';
import { AbstractSourceAdapter } from '../adapter/abstract-source-adapter.js';
import { ZendeskSection } from './model/zendesk-section.js';

export class ZendeskAdapter
  extends AbstractSourceAdapter<ZendeskCategory, ZendeskLabel, ZendeskArticle>
  implements ImageSourceAdapter
{
  private config: ZendeskConfig = {};
  private attachmentCache: { [key: string]: ZendeskArticleAttachment[] } = {};
  private attachmentDomainValidator?: AttachmentDomainValidator;
  private api: ZendeskApi;

  constructor() {
    super();

    this.api = new ZendeskApi();
  }

  public async initialize(
    config: ZendeskConfig,
    context: ZendeskContext,
  ): Promise<void> {
    await super.initialize(config, context);

    this.config = config;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
    return this.api.initialize(config);
  }

  public async *articleIterator(): AsyncGenerator<ZendeskArticle, void, void> {
    yield* this.api.articleIterator();
  }

  public async *categoryIterator(): AsyncGenerator<ZendeskSection, void, void> {
    yield* this.api.categoryIterator();
  }

  public async *labelIterator(): AsyncGenerator<ZendeskLabel, void, void> {
    yield* this.api.labelIterator();
  }

  public async *attachmentIterator(
    articleId: string,
  ): AsyncGenerator<ZendeskArticleAttachment, void, void> {
    yield* this.api.attachmentInfoListForArticleIterator(articleId);
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
    return removeTrailingSlash(
      this.config.relativeLinkBaseUrl || this.api.getInstanceUrl(),
    );
  }

  private async getAttachmentInfo(
    articleId: string,
    contentUrl: string,
  ): Promise<ZendeskArticleAttachment | undefined> {
    if (!this.attachmentCache[articleId]) {
      this.attachmentCache[articleId] = await arraysFromAsync(
        this.attachmentIterator(articleId),
      );
    }
    return this.attachmentCache[articleId].find(
      (item) =>
        item.content_url.startsWith(contentUrl) ||
        contentUrl.startsWith(item.content_url),
    );
  }
}
