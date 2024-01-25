import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document, ImportExportModel } from '../model/import-export-model.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';
import { GenesysSourceApi } from './genesys-source-api.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { Image } from '../model/image.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { fetchImage } from '../utils/web-client.js';
import logger from '../utils/logger.js';

/**
 * GenesysSourceAdapter implements {@Link SourceAdapter} to fetch data from Genesys Knowledge's API
 */
export class GenesysSourceAdapter
  implements SourceAdapter<Category, Label, Document>, ImageSourceAdapter
{
  private config: GenesysSourceConfig = {};
  private api: GenesysSourceApi;
  private exportedKnowledgeData: ImportExportModel | null = null;

  constructor() {
    this.api = new GenesysSourceApi();
  }

  public async initialize(config: GenesysSourceConfig): Promise<void> {
    this.config = config;
    await this.api.initialize(config);

    this.exportedKnowledgeData = await this.exportAllEntities();
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

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    return fetchImage(url);
  }

  private async exportAllEntities(): Promise<ImportExportModel> {
    logger.debug('Export articles in loader');
    const jobStatus = await this.api.createExportJob();
    logger.debug('Export job ' + JSON.stringify(jobStatus));
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
