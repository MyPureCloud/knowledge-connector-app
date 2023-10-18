import { Loader } from '../pipe/loader.js';
import { ZendeskAdapter } from './zendesk-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import logger from '../utils/logger.js';

/**
 * ZendeskLoader is a specific {@Link Loader} implementation for fetching data from Zendesk's API
 */
export class ZendeskLoader implements Loader {
  private adapter?: ZendeskAdapter;

  public initialize(
    _config: ZendeskConfig,
    adapters: AdapterPair<ZendeskAdapter, Adapter>,
  ): Promise<void> {
    this.adapter = adapters.sourceAdapter;
    return Promise.resolve();
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    logger.info('Fetching data... ZENDESK');
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
