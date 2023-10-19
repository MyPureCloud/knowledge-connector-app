import { Loader } from '../pipe/loader.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import logger from '../utils/logger.js';
import { GenesysSourceAdapter } from './genesys-source-adapter.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';

/**
 * Loader for fetching data from Genesys Knowledge
 */
export class GenesysLoader implements Loader {
  private adapter?: GenesysSourceAdapter;

  public async initialize(
    _config: GenesysSourceConfig,
    adapters: AdapterPair<GenesysSourceAdapter, Adapter>,
  ): Promise<void> {
    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    logger.info('Fetching data... GENESYS');
    const [categories, labels, articles] = await Promise.all([
      this.adapter!.getAllCategories(),
      this.adapter!.getAllLabels(),
      this.adapter!.getAllArticles(),
    ]);

    const data = contentMapper(categories, labels, articles);

    logger.info('Categories loaded: ' + data.categories.length);
    logger.info('Labels loaded: ' + data.labels.length);
    logger.info('Documents loaded: ' + data.documents.length);

    return data;
  }
}
