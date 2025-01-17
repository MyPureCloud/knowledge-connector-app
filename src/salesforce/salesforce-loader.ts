import { SalesforceAdapter } from './salesforce-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';

/**
 * SalesforceLoader is a specific {@Link Loader} implementation for fetching data from Salesforce's API
 */
export class SalesforceLoader extends AbstractLoader {
  private config: SalesforceConfig = {};
  private adapter?: SalesforceAdapter;

  public async initialize(
    config: SalesforceConfig,
    adapters: AdapterPair<SalesforceAdapter, Adapter>,
  ): Promise<void> {
    await super.initialize(config, adapters);

    this.config = config;
    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');

    const [categories, articles] = await Promise.all([
      this.loadCategories(),
      this.loadArticles(),
    ]);

    const baseUrl = this.adapter!.getResourceBaseUrl();

    articles.forEach((article) => this.replaceImageUrls(article));

    const data = contentMapper(
      categories,
      articles,
      this.config,
      this.shouldLoadCategories(),
      this.shouldBuildExternalUrls(),
      baseUrl,
    );

    getLogger().info('Labels loaded: ' + data.labels.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  private replaceImageUrls(article: SalesforceArticleDetails): void {
    article.layoutItems.forEach((item) => {
      if (item.type !== 'RICH_TEXT_AREA') {
        return;
      }

      const htmlString = item.value;
      const regex = /<img[^>]+?src="([^"]+)"/g;
      let match;
      while ((match = regex.exec(htmlString)) !== null) {
        const imageUrl = match[1];
        const replacedImgUrl = this.processImageUrl(imageUrl, item.name);
        item.value = item.value.replace(imageUrl, replacedImgUrl);
      }
    });
  }

  private processImageUrl(url: string, fieldType: string): string {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.replace(/&amp;/g, '&'));
    } catch (error) {
      getLogger().debug(`Cannot process image URL ${url} - ${error}`);
      // Invalid URL, treat it as relative
      return url;
    }

    const searchParams = new URLSearchParams(parsedUrl.search);
    const eid = searchParams.get('eid');
    const refid = searchParams.get('refid');

    if (eid == null || refid == null) {
      return url;
    }

    return `/${eid}/richTextImageFields/${fieldType}/${refid}`;
  }

  private async loadArticles(): Promise<SalesforceArticleDetails[]> {
    if (this.shouldLoadArticles()) {
      return this.adapter!.getAllArticles();
    }
    return [];
  }

  private async loadCategories(): Promise<SalesforceCategoryGroup[]> {
    if (this.shouldLoadCategories()) {
      return this.adapter!.getAllCategories();
    }
    return [];
  }
}
