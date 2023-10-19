import { Uploader } from './uploader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContents } from '../model/importable-contents.js';
import { ImportExportModel } from '../model/import-export-model.js';
import { GenesysDestinationConfig } from '../genesys/model/genesys-destination-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import logger from '../utils/logger.js';
import { generatedValueResolver } from './generated-value-resolver.js';

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

  public async run(importableContents: ImportableContents): Promise<void> {
    validateNonNull(
      this.config?.genesysKnowledgeBaseId,
      'Missing Genesys Knowledge Base Id',
    );
    validateNonNull(this.adapter, 'Missing destination adapter');

    const data: ImportExportModel = {
      version: 2,
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
    };

    logger.info(
      'Categories to create: ' + importableContents.categories.created.length,
    );
    logger.info(
      'Categories to update: ' + importableContents.categories.updated.length,
    );
    logger.info(
      'Labels to create: ' + importableContents.labels.created.length,
    );
    logger.info(
      'Labels to update: ' + importableContents.labels.updated.length,
    );
    logger.info(
      'Documents to create: ' + importableContents.documents.created.length,
    );
    logger.info(
      'Documents to update: ' + importableContents.documents.updated.length,
    );

    if (
      !data.labels.length &&
      !data.categories.length &&
      !data.documents.length
    ) {
      logger.info('There is no change to upload.');
      return;
    }

    logger.info('Uploading data...');

    const response = await this.adapter!.importData(data);
    logger.info('Upload finished');
    logger.info('Import job id: ' + response.id);
    logger.info('Import job status: ' + response.status);
    if (response.failedEntitiesURL) {
      logger.info('Errors during import: ' + response.failedEntitiesURL);
    }
  }
}
