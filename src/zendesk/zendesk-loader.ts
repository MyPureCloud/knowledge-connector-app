import { ZendeskAdapter } from './zendesk-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskCategory } from './model/zendesk-category.js';
import { ZendeskLabel } from './model/zendesk-label.js';

/**
 * ZendeskLoader is a specific {@Link Loader} implementation for fetching data from Zendesk's API
 */
export class ZendeskLoader extends AbstractLoader {
  private adapter?: ZendeskAdapter;

  public async initialize(
    _config: ZendeskConfig,
    adapters: AdapterPair<ZendeskAdapter, Adapter>,
  ): Promise<void> {
    await super.initialize(_config, adapters);

    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');
    const [categories, labels, articles] = await Promise.all([
      this.loadCategories(),
      this.loadLabels(),
      this.loadArticles(),
    ]);

    const data = contentMapper(
      categories,
      labels,
      articles,
      this.shouldLoadCategories(),
      this.shouldLoadLabels(),
    );

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Labels loaded: ' + data.labels.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  private async loadArticles(): Promise<ZendeskArticle[]> {
    if (this.shouldLoadArticles()) {
      return this.adapter!.getAllArticles();
    }
    return [];
  }

  private async loadCategories(): Promise<ZendeskCategory[]> {
    if (this.shouldLoadCategories()) {
      return this.adapter!.getAllCategories();
    }
    return [];
  }

  private async loadLabels(): Promise<ZendeskLabel[]> {
    if (this.shouldLoadLabels()) {
      return this.adapter!.getAllLabels();
    }
    return [];
  }
}
