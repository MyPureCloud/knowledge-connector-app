import { SearchAssetRequest } from './model/search-asset-request.js';
import { GenesysDestinationConfig } from './model/genesys-destination-config.js';
import { Image } from '../model/image.js';
import { Document, ImportExportModel } from '../model/import-export-model.js';
import { SyncDataResponse } from '../model/sync-data-response.js';
import { UploadAssetStatusResponse } from './model/upload-asset-status-response.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import logger from '../utils/logger.js';
import { GenesysDestinationApi } from './genesys-destination-api.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';

/**
 * GenesysDestinationAdapter is used by {@Link Uploader} to send collected data to Genesys Knowledge
 */
export class GenesysDestinationAdapter implements DestinationAdapter {
  private config: GenesysDestinationConfig = {};
  private api: GenesysDestinationApi;

  constructor() {
    this.api = new GenesysDestinationApi();
  }

  public initialize(config: GenesysDestinationConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public async lookupImage(hash: string): Promise<string | null> {
    const params: SearchAssetRequest = {
      sortBy: 'name',
      pageSize: 100,
      query: [
        {
          value: hash,
          fields: ['name'],
          type: 'STARTS_WITH',
        },
      ],
    };
    const response = await this.api.lookupImage(params);
    if (response && response.results && response.results.length) {
      return response.results[0].contentLocation || null;
    }
    return null;
  }

  public async uploadImage(hash: string, image: Image): Promise<string | null> {
    logger.debug('uploading image ' + image.url);
    const uploadUrl = await this.api.getUploadImageUrl({
      name: hash + '-' + image.name,
    });
    if (!uploadUrl || !uploadUrl.url) {
      logger.warn(`Cannot upload image [${image.url}]`);
      return null;
    }

    await this.api.upload(uploadUrl, image.content);
    await this.api.waitForJobToFinish<UploadAssetStatusResponse>(
      () => this.api.getUploadStatus(uploadUrl.id),
      ['Uploaded', 'Failed'],
    );

    return this.api
      .getUploadInfo(uploadUrl.id)
      .then((response) => response?.contentLocation);
  }

  public async exportAllEntities(): Promise<ImportExportModel> {
    const jobStatus = await this.api.createExportJob();

    const job = await this.api.waitForJobToFinish<ExportArticlesResponse>(
      () => this.api.getExportStatus(jobStatus.id),
      ['Completed', 'Failed', 'Aborted'],
    );

    if (!job.downloadURL) {
      throw Error('Missing downloadURL from export job ' + JSON.stringify(job));
    }

    return await this.api.fetchExportResult(job.downloadURL);
  }

  public async syncData(data: ImportExportModel): Promise<SyncDataResponse> {
    const fileName = 'sync-' + new Date().toISOString() + '.json';

    const { uploadKey } = await this.api.uploadSyncData(
      fileName,
      new Blob([JSON.stringify(data)], {
        type: 'application/json',
      }),
    );

    const job = await this.api.createSyncJob(uploadKey);

    return this.api.waitForJobToFinish<SyncDataResponse>(
      () => this.api.getSyncStatus(job.id),
      [
        'Completed',
        'PartialCompleted',
        'ValidationFailed',
        'Failed',
        'Aborted',
      ],
    );
  }

  public async deleteArticles(
    documents: Document[],
  ): Promise<BulkDeleteResponse[]> {
    const list = [...documents];
    const results: BulkDeleteResponse[] = [];
    while (list.length > 0) {
      const ids = list
        .splice(0, 100)
        .map((d) => d.id)
        .filter((id): id is string => id !== null);

      const result = await this.api.bulkDeleteArticles(ids);
      results.push(result);
    }
    return results;
  }
}
