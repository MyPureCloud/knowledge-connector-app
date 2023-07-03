import { Uploader } from './uploader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContents } from '../model/importable-contents.js';
import { GenesysDestinationConfig } from '../genesys/model/genesys-destination-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import logger from '../utils/logger.js';

/**
 * ObsoleteArticleRemover bulk deletes the articles from Genesys Knowledge which were removed from source system
 */
export class ObsoleteArticleRemover implements Uploader {
  private config?: GenesysDestinationConfig;
  private adapter?: GenesysDestinationAdapter;

  public initialize(
    config: GenesysDestinationConfig,
    adapters: AdapterPair<Adapter, GenesysDestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;

    return Promise.resolve(undefined);
  }

  public async run(importableContents: ImportableContents): Promise<void> {
    validateNonNull(
      this.config?.genesysKnowledgeBaseId,
      'Missing Genesys Knowledge Base Id',
    );
    validateNonNull(this.adapter, 'Missing destination adapter');

    logger.info(
      'Documents to remove: ' + importableContents.documents.deleted.length,
    );
    const responses = await this.adapter!.deleteArticles(
      importableContents.documents.deleted,
    );
    const errorCount = responses
      .map((response) => response.errorCount)
      .reduce((pValue, cValue) => pValue + cValue, 0);
    logger.info(
      'Documents removed: ' +
        (importableContents.documents.deleted.length - errorCount),
    );
    if (errorCount > 0) {
      logger.info('Errors: ' + JSON.stringify(responses));
    }
  }
}
