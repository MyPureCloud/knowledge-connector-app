import { SearchAssetRequest } from './model/search-asset-request.js';
import {
  AssetResponse,
  SearchAssetResponse,
} from './model/search-asset-response.js';
import { UploadAssetResponse } from './model/upload-asset-response.js';
import { UploadAssetRequest } from './model/upload-asset-request.js';
import { UploadAssetStatusResponse } from './model/upload-asset-status-response.js';
import { SyncDataResponse } from '../model/sync-data-response.js';
import { SyncDataRequest } from '../model/sync-data-request.js';
import { DocumentUploadResponse } from '../model/document-upload-response.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { GenesysApi } from './genesys-api.js';
import { GenesysDestinationConfig } from './model/genesys-destination-config.js';
import { fetchDestinationResource } from '../utils/web-client.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { getLogger } from '../utils/logger.js';
import { EntityType } from '../model/entity-type.js';
import { ContentType } from '../utils/content-type.js';
import { RequestInit } from '../utils/web-client';

export class GenesysDestinationApi extends GenesysApi {
  protected config: GenesysDestinationConfig = {};

  public initialize(config: GenesysDestinationConfig): Promise<void> {
    this.config = config;
    return this.authenticate();
  }

  protected getLoginUrl(): string {
    validateNonNull(
      this.config.genesysLoginUrl,
      'Missing GENESYS_LOGIN_URL from config',
    );
    return removeTrailingSlash(this.config.genesysLoginUrl!);
  }

  protected getBaseUrl(): string {
    validateNonNull(
      this.config.genesysBaseUrl,
      'Missing GENESYS_BASE_URL from config',
    );
    return removeTrailingSlash(this.config.genesysBaseUrl!);
  }

  protected getClientId(): string {
    validateNonNull(
      this.config.genesysClientId,
      'Missing GENESYS_CLIENT_ID from config',
    );
    return this.config.genesysClientId!;
  }

  protected getClientSecret(): string {
    validateNonNull(
      this.config.genesysClientSecret,
      'Missing GENESYS_CLIENT_SECRET from config',
    );
    return this.config.genesysClientSecret!;
  }

  protected getKnowledgeBaseId(): string {
    validateNonNull(
      this.config.genesysKnowledgeBaseId,
      'Missing GENESYS_KNOWLEDGE_BASE_ID from config',
    );
    return this.config.genesysKnowledgeBaseId!;
  }

  protected innerFetch<T>(
    url: string,
    init?: RequestInit,
    entityName?: EntityType,
  ): Promise<T> {
    return fetchDestinationResource(url, init, entityName);
  }

  public lookupImage(params: SearchAssetRequest): Promise<SearchAssetResponse> {
    return this.fetch<SearchAssetResponse>(
      '/api/v2/responsemanagement/responseassets/search',
      {
        method: 'POST',
      },
      params,
    );
  }

  public getUploadImageUrl(
    params: UploadAssetRequest,
  ): Promise<UploadAssetResponse> {
    return this.fetch<UploadAssetResponse>(
      '/api/v2/responsemanagement/responseassets/uploads',
      {
        method: 'POST',
      },
      params,
    );
  }

  public async upload(
    uploadUrl: UploadAssetResponse,
    blob: Blob,
    contentType: string,
  ): Promise<void> {
    const request = {
      method: 'PUT',
      headers: {
        ...uploadUrl.headers,
        'Content-Type': contentType,
      },
      body: blob,
    };

    await fetchDestinationResource(
      uploadUrl.url,
      request,
      EntityType.DOCUMENT,
      ContentType.TEXT,
    );
  }

  public getUploadStatus(uploadId: string): Promise<UploadAssetStatusResponse> {
    return this.fetch<UploadAssetStatusResponse>(
      `/api/v2/responsemanagement/responseassets/status/${uploadId}`,
    );
  }

  public getUploadInfo(uploadId: string): Promise<AssetResponse> {
    return this.fetch<AssetResponse>(
      `/api/v2/responsemanagement/responseassets/${uploadId}`,
    );
  }

  public async uploadSyncData(
    fileName: string,
    data: Blob,
  ): Promise<DocumentUploadResponse> {
    getLogger().debug(`Request signed URL for upload`);
    const { url, headers, uploadKey } =
      await this.fetch<DocumentUploadResponse>(
        `/api/v2/knowledge/documentuploads`,
        {
          method: 'POST',
        },
        {
          fileName,
        },
      );

    const uploadUrl = validateNonNull(url, 'Missing URL to upload to');

    getLogger().debug(`Uploading data (size: ${data.size})`);
    const request = {
      method: 'PUT',
      headers,
      body: data,
    };
    await fetchDestinationResource(uploadUrl, request, undefined, ContentType.TEXT);

    return { uploadKey };
  }

  public createSyncJob(uploadKey: string): Promise<SyncDataResponse> {
    const kbId = this.getKnowledgeBaseId();
    const body: SyncDataRequest = {
      uploadKey,
      sourceId: this.config?.genesysSourceId,
    };
    return this.fetch<SyncDataResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/synchronize/jobs`,
      {
        method: 'POST',
      },
      body,
    );
  }

  public getSyncStatus(syncId: string): Promise<SyncDataResponse> {
    const kbId = this.getKnowledgeBaseId();
    return this.fetch<SyncDataResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/synchronize/jobs/${syncId}?expand=urls`,
    );
  }

  public bulkDeleteArticles(ids: string[]): Promise<BulkDeleteResponse> {
    const kbId = this.getKnowledgeBaseId();
    return this.fetch<BulkDeleteResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/documents/bulk/remove`,
      {
        method: 'POST',
      },
      {
        entities: ids.map((id) => ({ id })),
      },
    );
  }
}
