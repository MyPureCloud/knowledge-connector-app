import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { ExportModel } from '../model/sync-export-model.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';
import { GenesysSourceApi } from './genesys-source-api.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { Image } from '../model/image.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { fetchImage } from '../utils/web-client.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { InvalidExportJobError } from './errors/invalid-export-job-error.js';
import { GenesysContext } from './model/genesys-context.js';
import { AbstractSourceAdapter } from '../adapter/abstract-source-adapter.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { ExternalLink } from '../model/external-link.js';

/**
 * GenesysSourceAdapter extends {@Link AbstractSourceAdapter}, implements {@Link ImageSourceAdapter} to fetch data from Genesys Knowledge's API
 */
export class GenesysSourceAdapter
  extends AbstractSourceAdapter<Category, Label, Document>
  implements ImageSourceAdapter
{
  private static DOCUMENT_LINK_REGEXP =
    /grn:knowledge:::documentVariation\/[0-9a-fA-F-]+\/([0-9a-fA-F-]+)\/([0-9a-fA-F-]+)/;

  private api: GenesysSourceApi;
  private exportedKnowledgeData: ExportModel | null = null;
  private attachmentDomainValidator?: AttachmentDomainValidator;

  constructor() {
    super();

    this.api = new GenesysSourceApi();
  }

  public async initialize(
    config: GenesysSourceConfig,
    context: GenesysContext,
  ): Promise<void> {
    await super.initialize(config, context);

    await this.api.initialize(config);

    this.exportedKnowledgeData = await this.exportAllEntities();
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (this.exportedKnowledgeData?.importAction?.categories) {
      for (const category of this.exportedKnowledgeData.importAction
        .categories) {
        yield category;
      }
    }
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (this.exportedKnowledgeData?.importAction?.labels) {
      for (const label of this.exportedKnowledgeData.importAction.labels) {
        yield label;
      }
    }
  }

  public async *articleIterator(): AsyncGenerator<Document, void, void> {
    if (this.exportedKnowledgeData?.importAction?.documents) {
      for (const document of this.exportedKnowledgeData.importAction
        .documents) {
        yield document;
      }
    }
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return GenesysSourceAdapter.DOCUMENT_LINK_REGEXP;
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
      throw new AttachmentDomainNotAllowedError(url, articleId);
    }
    return fetchImage(url);
  }

  public getResourceBaseUrl(): string {
    return removeTrailingSlash(this.api.getInstanceUrl() || '');
  }

  public async constructDocumentLink(
    _id: string,
  ): Promise<ExternalLink | null> {
    return null;
  }

  private async exportAllEntities(): Promise<ExportModel> {
    getLogger().debug('Export articles in loader');
    const jobStatus = await this.api.createExportJob();
    getLogger().debug('Export job ' + JSON.stringify(jobStatus));
    const job = await this.api.waitForJobToFinish<ExportArticlesResponse>(
      () => this.api.getExportStatus(jobStatus.id),
      ['Completed', 'Failed', 'Aborted'],
    );

    if (!job.downloadURL) {
      throw new InvalidExportJobError(
        `Missing downloadURL from source export job ${job.id}`,
        { job },
      );
    }

    return this.api.fetchExportResult(job.downloadURL);
  }
}
