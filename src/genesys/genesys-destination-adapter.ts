import { SearchAssetRequest } from './model/search-asset-request.js';
import { GenesysDestinationConfig } from './model/genesys-destination-config.js';
import { Image } from '../model/image.js';
import { Document } from '../model/document.js';
import { ExportModel, SyncModel } from '../model/sync-export-model.js';
import { SyncDataResponse } from '../model/sync-data-response.js';
import { UploadAssetStatusResponse } from './model/upload-asset-status-response.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { GenesysDestinationApi } from './genesys-destination-api.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { getLogger } from '../utils/logger.js';
import { fileTypeFromBuffer } from 'file-type';
import { FileTypeNotSupportedError } from './errors/file-type-not-supported-error.js';
import { InvalidExportJobError } from './errors/invalid-export-job-error.js';
import { CompareMode } from '../utils/compare-mode.js';
import { ExcludeOptions } from '../model/exclude-options.js';

const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif'];

/**
 * GenesysDestinationAdapter is used by {@Link Uploader} to send collected data to Genesys Knowledge
 */
export class GenesysDestinationAdapter implements DestinationAdapter {
  private readonly api: GenesysDestinationApi;

  private config: GenesysDestinationConfig = {};

  constructor() {
    this.api = new GenesysDestinationApi();
  }

  public initialize(config: GenesysDestinationConfig): Promise<void> {
    this.config = config;
    return this.getApi().initialize(config);
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
    const response = await this.getApi().lookupImage(params);
    if (response?.results?.length > 0) {
      return response.results[0].contentLocation || null;
    }
    return null;
  }

  public async uploadImage(hash: string, image: Image): Promise<string | null> {
    const contentType = await this.getContentType(image);

    const name = this.escapeName(hash + '-' + image.name);

    getLogger().debug(`Uploading image from ${image.url} with name ${name}`);

    const uploadUrl = await this.getApi().getUploadImageUrl({
      name,
    });

    if (!uploadUrl?.url) {
      getLogger().warn(`Cannot upload image [${image.url}]`);
      return null;
    }

    await this.getApi().upload(uploadUrl, image.content, contentType);
    await this.getApi().waitForJobToFinish<UploadAssetStatusResponse>(
      () => this.getApi().getUploadStatus(uploadUrl.id),
      ['Uploaded', 'Failed'],
    );

    return this.getApi()
      .getUploadInfo(uploadUrl.id)
      .then((response) => response?.contentLocation);
  }

  public async exportAllEntities(): Promise<ExportModel> {
    const jobStatus = await this.getApi().createExportJob(this.buildExcludesList());

    const job = await this.getApi().waitForJobToFinish<ExportArticlesResponse>(
      () => this.getApi().getExportStatus(jobStatus.id),
      ['Completed', 'Failed', 'Aborted'],
    );

    if (!job.downloadURL) {
      throw new InvalidExportJobError(
        `Missing downloadURL from destination export job ${job.id}`,
        { job },
      );
    }

    return await this.getApi().fetchExportResult(job.downloadURL);
  }

  public async syncData(data: SyncModel): Promise<SyncDataResponse> {
    const fileName = 'sync-' + new Date().toISOString() + '.json';

    const { uploadKey } = await this.getApi().uploadSyncData(
      fileName,
      new Blob([JSON.stringify(data)], {
        type: 'application/json',
      }),
    );

    const job = await this.getApi().createSyncJob(uploadKey);

    return this.getApi().waitForJobToFinish<SyncDataResponse>(
      () => this.getApi().getSyncStatus(job.id),
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

      const result = await this.getApi().bulkDeleteArticles(ids);
      results.push(result);
    }
    return results;
  }

  public getApi(): GenesysDestinationApi {
    return this.api;
  }

  private escapeName(name: string): string {
    return name.replaceAll(/[\\{^}%`\]">[~<#|/ ]/g, '-');
  }

  private async getContentType(image: Image): Promise<string> {
    const fileType = await fileTypeFromBuffer(
      await image.content.arrayBuffer(),
    );

    if (!fileType?.ext || !SUPPORTED_FORMATS.includes(fileType.ext)) {
      throw new FileTypeNotSupportedError(
        fileType?.ext || 'unknown',
        SUPPORTED_FORMATS,
      );
    }

    return fileType.mime;
  }

  private buildExcludesList(): ExcludeOptions[] {
    const excludes = [] as ExcludeOptions[];

    if (this.config.fetchCategories === 'false' ) {
      getLogger().debug('Adding Categories to Genesys destination export exclude list');
      excludes.push(ExcludeOptions.CATEGORIES)
    }
    if (this.config.fetchLabels === 'false' ) {
      getLogger().debug('Adding Labels to Genesys destination export exclude list');
      excludes.push(ExcludeOptions.LABELS)
    }
    const compareMode = this.config.compareMode ?? CompareMode.MODIFICATION_DATE;
    if (compareMode === CompareMode.MODIFICATION_DATE) {
      getLogger().debug('Adding Variations to Genesys destination export exclude list');
      excludes.push(ExcludeOptions.VARIATIONS)
    }

    return excludes;
  }
}
