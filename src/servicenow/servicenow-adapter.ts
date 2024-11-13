import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Image } from '../model/image.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';

export class ServiceNowAdapter
  implements
    SourceAdapter<unknown, unknown, ServiceNowArticle>,
    ImageSourceAdapter
{
  private static ARTICLE_NUMBER_REGEX =
    /(?:sysparm_article|sys_kb_id)(?:&#61;|=)([A-Za-z0-9]+)/;

  private config: ServiceNowConfig = {};
  private api: ServiceNowApi;
  private attachmentDomainValidator?: AttachmentDomainValidator;

  constructor() {
    this.api = new ServiceNowApi();
  }

  public initialize(config: ServiceNowConfig): Promise<void> {
    this.config = config;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
    return this.api.initialize(config);
  }

  public async getAllArticles(): Promise<ServiceNowArticle[]> {
    return arraysFromAsync(this.articleIterator());
  }

  public async getAllCategories(): Promise<ServiceNowCategory[]> {
    return arraysFromAsync(this.categoryIterator());
  }

  public async getAllLabels(): Promise<unknown[]> {
    return arraysFromAsync(this.labelIterator());
  }

  public async *categoryIterator(): AsyncGenerator<
    ServiceNowCategory,
    void,
    void
  > {
    yield* this.api.categoryIterator();
  }

  public async *labelIterator(): AsyncGenerator<unknown, void, void> {}

  public async *articleIterator(): AsyncGenerator<
    ServiceNowArticle,
    void,
    void
  > {
    yield* this.api.articleIterator();
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return ServiceNowAdapter.ARTICLE_NUMBER_REGEX;
  }

  public async getAttachment(
    articleId: string | null,
    attachmentUrl: string,
  ): Promise<Image | null> {
    // sys_id=e78fb8af47474650376bb52f316d4313 or sys_id&#61;e78fb8af47474650376bb52f316d4313
    const attachmentIdMatch = attachmentUrl.match(/sys_id(?:=|&#61;)([^&]+)/);
    if (!attachmentIdMatch || !articleId) {
      return null;
    }

    const info = await this.getAttachmentInfo(attachmentIdMatch[1]);
    if (!info) {
      articleId = articleId.split(':')[1];
      getLogger().warn(
        `Cannot find attachment [${attachmentUrl}] for article [${articleId}]`,
      );
      return null;
    }

    const {
      result: {
        download_link: url,
        file_name: name,
        content_type: contentType,
      },
    } = info;

    if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
      throw new AttachmentDomainNotAllowedError(url);
    }
    const content = await this.api.downloadAttachment(url);

    return {
      url,
      name,
      contentType,
      content,
    };
  }

  public getResourceBaseUrl(): string {
    return removeTrailingSlash(
      this.config.relativeLinkBaseUrl || this.api.getInstanceUrl(),
    );
  }

  private async getAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment | undefined> {
    return this.api.fetchAttachmentInfo(attachmentId);
  }
}
