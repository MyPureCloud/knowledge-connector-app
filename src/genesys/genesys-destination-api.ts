import { SearchAssetRequest } from './model/search-asset-request.js';
import {
  AssetResponse,
  SearchAssetResponse,
} from './model/search-asset-response.js';
import { UploadAssetResponse } from './model/upload-asset-response.js';
import { UploadAssetRequest } from './model/upload-asset-request.js';
import { Blob } from 'buffer';
import { UploadAssetStatusResponse } from './model/upload-asset-status-response.js';
import { ImportDataResponse } from '../model/import-data-response.js';
import { ImportDataRequest } from '../model/import-data-request.js';
import { DocumentUploadResponse } from '../model/document-upload-response.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { GenesysApi } from './genesys-api.js';
import { GenesysDestinationConfig } from './model/genesys-destination-config.js';
import { fetch } from '../utils/web-client.js';

export class GenesysDestinationApi extends GenesysApi {
  private config: GenesysDestinationConfig = {};

  public initialize(config: GenesysDestinationConfig): Promise<void> {
    this.config = config;
    return this.authenticate();
  }

  protected getLoginUrl(): string {
    validateNonNull(
      this.config.genesysLoginUrl,
      'Missing GENESYS_LOGIN_URL from config',
    );
    return this.config.genesysLoginUrl!;
  }

  protected getBaseUrl(): string {
    validateNonNull(
      this.config.genesysBaseUrl,
      'Missing GENESYS_BASE_URL from config',
    );
    return this.config.genesysBaseUrl!;
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
  ): Promise<void> {
    const response = await fetch(uploadUrl.url, {
      method: 'PUT',
      headers: uploadUrl.headers,
      body: blob,
    });
    await this.verifyResponse(response, uploadUrl.url);

    await response.text();
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

  public async uploadImportData(
    fileName: string,
    data: Blob,
  ): Promise<DocumentUploadResponse> {
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

    validateNonNull(url, 'Missing URL to upload to');

    const response = await fetch(url!, {
      method: 'PUT',
      headers,
      body: data,
    });
    await this.verifyResponse(response, url!);

    return { uploadKey };
  }

  public createImportJob(uploadKey: string): Promise<ImportDataResponse> {
    const kbId = this.getKnowledgeBaseId();
    const body: ImportDataRequest = {
      uploadKey,
      fileType: 'json',
      skipConfirmationStep: true,
    };
    return this.fetch<ImportDataResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/import/jobs`,
      {
        method: 'POST',
      },
      body,
    );
  }

  public getImportStatus(importId: string): Promise<ImportDataResponse> {
    const kbId = this.getKnowledgeBaseId();
    return this.fetch<ImportDataResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/import/jobs/${importId}?expand=urls`,
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
