import { Loader } from '../pipe/loader.js';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { contentMapper } from './content-mapper.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import logger from '../utils/logger.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';

/**
 * SalesforceLoader is a specific {@Link Loader} implementation for fetching data from Salesforce's API
 */
export class SalesforceLoader implements Loader {
  private config: SalesforceConfig = {};
  private adapter?: SalesforceAdapter;

  public async initialize(
    config: SalesforceConfig,
    adapters: AdapterPair<SalesforceAdapter, Adapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.sourceAdapter;
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');
    validateNonNull(
      this.config.salesforceArticleContentFields,
      'Missing SALESFORCE_ARTICLE_CONTENT_FIELDS from config',
    );

    logger.info('Fetching data...');
    const [categories, articles] = await Promise.all([
      this.adapter!.getAllCategories(),
      this.adapter!.getAllArticles(),
    ]);

    articles.forEach((article) => this.replaceImageUrls(article));
    const data = contentMapper(
      categories,
      articles,
      this.config.salesforceArticleContentFields!.split(','),
    );

    logger.info('Labels loaded: ' + data.labels.length);
    logger.info('Documents loaded: ' + data.documents.length);

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
    const parsedUrl = new URL(url.replace(/&amp;/g, '&'));
    const searchParams = new URLSearchParams(parsedUrl.search);
    const eid = searchParams.get('eid');
    const refid = searchParams.get('refid');
    return `/${eid}/richTextImageFields/${fieldType}/${refid}`;
  }
}
