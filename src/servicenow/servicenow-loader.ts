import { Loader } from '../pipe/loader.js';
import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';

/**
 * ServiceNow is a specific {@Link Loader} implementation for fetching data from ServiceNow API
 */
export class ServiceNowLoader implements Loader {
  private adapter?: ServiceNowAdapter;

  public async initialize(
    _config: ServiceNowConfig,
    adapters: AdapterPair<ServiceNowAdapter, Adapter>,
  ): Promise<void> {
    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');
    const articles = await this.adapter!.getAllArticles();

    const data = contentMapper(articles);

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }
}
