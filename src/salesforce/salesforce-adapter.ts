import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { Image } from '../model/image.js';
import { SalesforceApi } from './salesforce-api.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { arraysFromAsync } from '../utils/arrays.js';

export class SalesforceAdapter
  implements
    SourceAdapter<SalesforceCategoryGroup, unknown, SalesforceArticleDetails>,
    ImageSourceAdapter
{
  private static URL_NAME_REGEX = /\/articles\/[^/]+\/Knowledge\/([^/]+)/;
  private static ATTACHMENT_RELATIVE_PATH_REGEX =
    /^\/[^/]+\/richTextImageFields\/[^/]+\/[^/]+$/;
  private config: SalesforceConfig = {};
  private api: SalesforceApi;

  constructor() {
    this.api = new SalesforceApi();
  }

  public initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    return this.api.initialize(config);
  }

  public async getAllArticles(): Promise<SalesforceArticleDetails[]> {
    return arraysFromAsync(this.articleIterator());
  }

  public async getAllCategories(): Promise<SalesforceCategoryGroup[]> {
    return arraysFromAsync(this.categoryIterator());
  }

  public getAllLabels(): Promise<unknown[]> {
    return Promise.reject();
  }

  public async *articleIterator(): AsyncGenerator<
    SalesforceArticleDetails,
    void,
    void
  > {
    yield* this.api.articleIterator();
  }

  public async *categoryIterator(): AsyncGenerator<
    SalesforceCategoryGroup,
    void,
    void
  > {
    yield* this.api.categoryIterator();
  }

  public async *labelIterator(): AsyncGenerator<unknown, void, void> {}

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return SalesforceAdapter.URL_NAME_REGEX;
  }

  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (!SalesforceAdapter.ATTACHMENT_RELATIVE_PATH_REGEX.test(url)) {
      return null;
    }
    return this.api.getAttachment(articleId, url);
  }

  public getResourceBaseUrl(): string {
    return removeTrailingSlash(
      this.config.relativeLinkBaseUrl || this.api.getInstanceUrl(),
    );
  }
}
