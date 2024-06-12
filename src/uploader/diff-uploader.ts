import { Uploader } from './uploader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { SyncableContents } from '../model/syncable-contents.js';
import { SyncModel } from '../model/sync-export-model.js';
import { GenesysDestinationConfig } from '../genesys/model/genesys-destination-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { generatedValueResolver } from './generated-value-resolver.js';
import { getLogger } from '../utils/logger.js';

/**
 * DiffUploader collects all the new and changed entities into a JSON format and uploads it to Genesys Knowledge's import API
 */
export class DiffUploader implements Uploader {
  private config?: GenesysDestinationConfig;
  private adapter?: GenesysDestinationAdapter;

  public async initialize(
    config: GenesysDestinationConfig,
    adapters: AdapterPair<Adapter, GenesysDestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;
  }

  public async run(importableContents: SyncableContents): Promise<void> {
    validateNonNull(
      this.config?.genesysKnowledgeBaseId,
      'Missing Genesys Knowledge Base Id',
    );
    validateNonNull(this.adapter, 'Missing destination adapter');

    const data: SyncModel = {
      version: 3,
      sourceId: this.config?.genesysSourceId,
      readonlyContent: this.config?.genesysReadonlyContent === 'true',
      importAction: {
        knowledgeBase: {
          id: this.config!.genesysKnowledgeBaseId!,
        },
        categories: [
          ...importableContents.categories.created,
          ...importableContents.categories.updated,
        ].map(generatedValueResolver),
        labels: [
          ...importableContents.labels.created,
          ...importableContents.labels.updated,
        ].map(generatedValueResolver),
        documents: [
          ...importableContents.documents.created,
          ...importableContents.documents.updated,
        ].map(generatedValueResolver),
      },
      deleteAction: {
        documents: importableContents.documents.deleted
          .filter((document) => document.id !== null)
          .map((document) => document.id!),
        categories: importableContents.categories.deleted
          .filter((category) => category.id !== null)
          .map((category) => category.id!),
        labels: importableContents.labels.deleted
          .filter((label) => label.id !== null)
          .map((label) => label.id!),
      },
    };

    getLogger().info(
      'Categories to create: ' + importableContents.categories.created.length,
    );
    getLogger().info(
      'Categories to update: ' + importableContents.categories.updated.length,
    );
    getLogger().info(
      'Categories to delete: ' + importableContents.categories.deleted.length,
    );
    getLogger().info(
      'Labels to create: ' + importableContents.labels.created.length,
    );
    getLogger().info(
      'Labels to update: ' + importableContents.labels.updated.length,
    );
    getLogger().info(
      'Labels to delete: ' + importableContents.labels.deleted.length,
    );
    getLogger().info(
      'Documents to create: ' + importableContents.documents.created.length,
    );
    getLogger().info(
      'Documents to update: ' + importableContents.documents.updated.length,
    );
    getLogger().info(
      'Documents to delete: ' + importableContents.documents.deleted.length,
    );

    if (
      !data.importAction.labels.length &&
      !data.importAction.categories.length &&
      !data.importAction.documents.length &&
      !data.deleteAction.categories.length &&
      !data.deleteAction.labels.length &&
      !data.deleteAction.documents.length
    ) {
      getLogger().info('There is no change to upload.');
      return;
    }

    getLogger().info('Uploading data...');

    const response = await this.adapter!.syncData(data);
    getLogger().info('Upload finished');
    getLogger().info('Sync job id: ' + response.id);
    getLogger().info('Sync job status: ' + response.status);
    if (response.failedEntitiesURL) {
      getLogger().info('Errors during import: ' + response.failedEntitiesURL);
    }
  }
}
