import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document, ExportModel } from '../model/sync-export-model.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';
import { GenesysSourceApi } from './genesys-source-api.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { Image } from '../model/image.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { fetchImage } from '../utils/web-client.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-not-allowed-error.js';

/**
 * GenesysSourceAdapter implements {@Link SourceAdapter} to fetch data from Genesys Knowledge's API
 */
export class GenesysSourceAdapter
  implements SourceAdapter<Category, Label, Document>, ImageSourceAdapter
{
  private static DOCUMENT_LINK_REGEXP =
    /grn:knowledge:::documentVariation\/[0-9a-fA-F-]+\/([0-9a-fA-F-]+)\/([0-9a-fA-F-]+)/;

  private config: GenesysSourceConfig = {};
  private api: GenesysSourceApi;
  private exportedKnowledgeData: ExportModel | null = null;
  private attachmentDomainValidator?: AttachmentDomainValidator;

  constructor() {
    this.api = new GenesysSourceApi();
  }

  public async initialize(config: GenesysSourceConfig): Promise<void> {
    this.config = config;
    await this.api.initialize(config);

    this.exportedKnowledgeData = await this.exportAllEntities();
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
  }

  public async getAllArticles(): Promise<Document[]> {
    return this.exportedKnowledgeData?.importAction?.documents || [];
  }

  public async getAllCategories(): Promise<Category[]> {
    return this.exportedKnowledgeData?.importAction?.categories || [];
  }

  public async getAllLabels(): Promise<Label[]> {
    return this.exportedKnowledgeData?.importAction?.labels || [];
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return GenesysSourceAdapter.DOCUMENT_LINK_REGEXP;
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
      throw new AttachmentDomainNotAllowedError(url);
    }
    return fetchImage(url);
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
      throw Error('Missing downloadURL from export job ' + JSON.stringify(job));
    }

    return this.api.fetchExportResult(job.downloadURL);
  }
}
