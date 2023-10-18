import { Uploader } from './uploader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContents } from '../model/importable-contents.js';
import { GenesysDestinationConfig } from '../genesys/model/genesys-destination-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import logger from '../utils/logger.js';

/**
 * ObsoleteDocumentRemover bulk deletes the articles from Genesys Knowledge which were removed from source system
 */
export class ObsoleteDocumentRemover implements Uploader {
  private config: GenesysDestinationConfig = {};
  private adapter?: GenesysDestinationAdapter;

  public async initialize(
    config: GenesysDestinationConfig,
    adapters: AdapterPair<Adapter, GenesysDestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;
  }

  public async run(importableContents: ImportableContents): Promise<void> {
    validateNonNull(this.adapter, 'Missing destination adapter');

    const prefix = this.config.externalIdPrefix;
    let itemsToDelete = importableContents.documents.deleted;
    if (prefix) {
      itemsToDelete = importableContents.documents.deleted.filter(
        (item) => item.externalId && item.externalId.startsWith(prefix),
      );
    }

    logger.info('Documents to remove: ' + itemsToDelete.length);
    const responses = await this.adapter!.deleteArticles(itemsToDelete);
    const errorCount = responses
      .map((response) => response.errorCount)
      .reduce((pValue, cValue) => pValue + cValue, 0);

    logger.info('Documents removed: ' + (itemsToDelete.length - errorCount));
    if (errorCount > 0) {
      logger.info('Errors: ' + JSON.stringify(responses));
    }
  }
}
