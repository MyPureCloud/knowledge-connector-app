import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Image } from '../model/image.js';
import logger from '../utils/logger.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';

export class ServiceNowAdapter
  implements
    SourceAdapter<unknown, unknown, ServiceNowArticle>,
    ImageSourceAdapter
{
  private config: ServiceNowConfig = {};
  private api: ServiceNowApi;

  constructor() {
    this.api = new ServiceNowApi();
  }

  public initialize(config: ServiceNowConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public getAllArticles(): Promise<ServiceNowArticle[]> {
    return this.api.fetchAllArticles();
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    const attachmentIdMatch = url.match(/sys_id=([^&]+)/);
    if (!attachmentIdMatch || !articleId) {
      return null;
    }

    const info = await this.getAttachmentInfo(attachmentIdMatch[1]);
    if (!info) {
      articleId = articleId.split(':')[1];
      logger.warn(`Cannot find attachment [${url}] for article [${articleId}]`);
      return null;
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

  private async getAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment | undefined> {
    return this.api.fetchAttachmentInfo(attachmentId);
  }

  public getAllCategories(): Promise<unknown[]> {
    return Promise.reject();
  }

  public getAllLabels(): Promise<unknown[]> {
    return Promise.reject();
  }
}
