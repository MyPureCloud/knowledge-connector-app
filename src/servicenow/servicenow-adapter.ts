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

export class ServiceNowAdapter
  implements
    SourceAdapter<unknown, unknown, ServiceNowArticle>,
    ImageSourceAdapter
{
  private static ARTICLE_NUMBER_REGEX = /(?:sysparm_article|sys_kb_id)(?:&#61;|=)([A-Za-z0-9]+)/;

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

  public getAllArticles(): Promise<ServiceNowArticle[]> {
    return this.api.fetchAllArticles();
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return ServiceNowAdapter.ARTICLE_NUMBER_REGEX;
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    // sys_id=e78fb8af47474650376bb52f316d4313 or sys_id&#61;e78fb8af47474650376bb52f316d4313
    const attachmentIdMatch = url.match(/sys_id(?:=|&#61;)([^&]+)/);
    if (!attachmentIdMatch || !articleId) {
      return null;
    }

    const info = await this.getAttachmentInfo(attachmentIdMatch[1]);
    if (!info) {
      articleId = articleId.split(':')[1];
      getLogger().warn(
        `Cannot find attachment [${url}] for article [${articleId}]`,
      );
      return null;
    }

    if (
      !this.attachmentDomainValidator!.isDomainAllowed(
        info.result.download_link,
      )
    ) {
      throw new AttachmentDomainNotAllowedError(info.result.download_link);
    }
    const content = await this.api.downloadAttachment(
      info.result.download_link,
    );

    return {
      url: info.result.download_link,
      name: info.result.file_name,
      contentType: info.result.content_type,
      content,
    };
  }

  public getAllCategories(): Promise<unknown[]> {
    return Promise.reject();
  }

  public getAllLabels(): Promise<unknown[]> {
    return Promise.reject();
  }

  private async getAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment | undefined> {
    return this.api.fetchAttachmentInfo(attachmentId);
  }
}
