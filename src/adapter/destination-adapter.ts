import { Adapter } from './adapter.js';
import { Image } from '../model/image.js';
import { Document } from '../model/document.js';
import { ExportModel, SyncModel } from '../model/sync-export-model.js';
import { SyncDataResponse } from '../model/sync-data-response.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { Config } from '../config.js';

/**
 * Adapter to connect to destination system
 */
export interface DestinationAdapter extends Adapter {
  initialize(config: Config): Promise<void>;

  lookupImage(hash: string): Promise<string | null>;

  uploadImage(hash: string, image: Image): Promise<string | null>;

  exportAllEntities(): Promise<ExportModel>;

  syncData(data: SyncModel): Promise<SyncDataResponse>;

  deleteArticles(documents: Document[]): Promise<BulkDeleteResponse[]>;
}
