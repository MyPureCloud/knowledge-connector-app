import { Loader } from '../pipe/loader.js';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import logger from '../utils/logger.js';

/**
 * SalesforceLoader is a specific {@Link Loader} implementation for fetching data from Salesforce's API
 */
export class SalesforceLoader implements Loader {
  private adapter?: SalesforceAdapter;

  public async initialize(
    _config: SalesforceConfig,
    adapters: AdapterPair<SalesforceAdapter, Adapter>,
  ): Promise<void> {
    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    logger.info('Fetching data... Salesforce');
    let [categories, articles] = await Promise.all([
      this.adapter!.getAllCategories(),
      this.adapter!.getAllArticles(),
    ]);

    const data = contentMapper(categories, [], articles);

    logger.info('Categories loaded: ' + data.categories.length);
    logger.info('Labels loaded: ' + data.labels.length);
    logger.info('Documents loaded: ' + data.documents.length);

    return data;
  }
}
