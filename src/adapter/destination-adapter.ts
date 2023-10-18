import { Adapter } from './adapter.js';
import { Image } from '../model/image.js';
import { Document, ImportExportModel } from '../model/import-export-model.js';
import { ImportDataResponse } from '../model/import-data-response.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { Config } from '../config.js';

/**
 * Adapter to connect to destination system
 */
export interface DestinationAdapter extends Adapter {
  initialize(config: Config): Promise<void>;

  lookupImage(hash: string): Promise<string | null>;

  uploadImage(hash: string, image: Image): Promise<string | null>;

  exportAllEntities(): Promise<ImportExportModel>;

  importData(data: ImportExportModel): Promise<ImportDataResponse>;

  deleteArticles(documents: Document[]): Promise<BulkDeleteResponse[]>;
}
