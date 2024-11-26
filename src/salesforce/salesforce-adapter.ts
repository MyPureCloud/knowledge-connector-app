import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { Image } from '../model/image.js';
import { SalesforceApi } from './salesforce-api.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';

export class SalesforceAdapter
  implements
    SourceAdapter<SalesforceCategoryGroup, unknown, SalesforceArticleDetails>,
    ImageSourceAdapter
{
  private static URL_NAME_REGEX = /\/articles\/[^/]+\/Knowledge\/([^/]+)/;
  private config: SalesforceConfig = {};
  private api: SalesforceApi;

  constructor() {
    this.api = new SalesforceApi();
  }

  public initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public getAllArticles(): Promise<SalesforceArticleDetails[]> {
    return this.api.fetchAllArticles();
  }

  public getAllCategories(): Promise<SalesforceCategoryGroup[]> {
    return this.api.fetchAllCategories();
  }

  public getAllLabels(): Promise<unknown[]> {
    return Promise.reject();
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return SalesforceAdapter.URL_NAME_REGEX;
  }

  public getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    return this.api.getAttachment(articleId, url);
  }

  public getResourceBaseUrl(): string {
    return this.api.getInstanceUrl();
  }
}
