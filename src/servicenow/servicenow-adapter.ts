import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Image } from '../model/image.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { AbstractSourceAdapter } from '../adapter/abstract-source-adapter.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { ExternalLink } from '../model/external-link.js';
import { ServiceNowSingleArticle } from './model/servicenow-single-article-response.js';

export class ServiceNowAdapter
  extends AbstractSourceAdapter<unknown, unknown, ServiceNowArticle>
  implements ImageSourceAdapter
{
  private static ARTICLE_REGEX =
    /(?:sysparm_article|sys_kb_id)(?:&#61;|=|%3D)([A-Za-z0-9]+)/;

  private config: ServiceNowConfig = {};
  private api: ServiceNowApi;
  private attachmentDomainValidator?: AttachmentDomainValidator;

  constructor() {
    super();

    this.api = new ServiceNowApi();
  }

  public async initialize(
    config: ServiceNowConfig,
    context: ServiceNowContext,
  ): Promise<void> {
    await super.initialize(config, context);

    this.config = config;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
    return this.api.initialize(config, context);
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
    return ServiceNowAdapter.ARTICLE_REGEX;
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

  public async constructDocumentLink(id: string): Promise<ExternalLink | null> {
    try {
      const article = await this.getVisibleArticle(id);

      if (!article) {
        return null;
      }

      return {
        externalDocumentId: `${article.number}`,
        externalDocumentIdAlternatives: [`kb_knowledge:${article.sys_id}`],
      };
    } catch (error) {
      getLogger().error(`Failed to fetch single article ${id}`, error as Error);
    }

    return null;
  }

  private async getVisibleArticle(
    id: string,
  ): Promise<ServiceNowSingleArticle | null> {
    const article = await this.api.getArticle(id);

    if (!article || article.number === id) {
      // Article not found or the given id is already an article's "number"
      return article;
    }

    return this.api.getArticle(article.number);
  }

  private async getAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment | undefined> {
    return this.api.fetchAttachmentInfo(attachmentId);
  }
}
