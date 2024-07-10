import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { ServiceNowArticle } from './model/servicenow-article';

/**
 * ServiceNow is a specific {@Link Loader} implementation for fetching data from ServiceNow API
 */
export class ServiceNowLoader extends AbstractLoader {
  private adapter?: ServiceNowAdapter;

  public async initialize(
    _config: ServiceNowConfig,
    adapters: AdapterPair<ServiceNowAdapter, Adapter>,
  ): Promise<void> {
    await super.initialize(_config, adapters);

    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');
    const articles = await this.adapter!.getAllArticles();

    const data = contentMapper(articles, this.shouldLoadCategories());

    if (!this.shouldLoadArticles()) {
      data.documents = [];
    }
    if (!this.shouldLoadCategories()) {
      data.categories = [];
    }

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }
}
