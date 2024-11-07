import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { Image } from '../model/image.js';
import { SalesforceApi } from './salesforce-api.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceContext } from './model/salesforce-context.js';
import { AbstractSourceAdapter } from '../adapter/abstract-source-adapter.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';

export class SalesforceAdapter
  extends AbstractSourceAdapter<
    SalesforceCategoryGroup,
    unknown,
    SalesforceArticleDetails
  >
  implements ImageSourceAdapter
{
  private static URL_NAME_REGEX = /\/articles\/[^/]+\/Knowledge\/([^/]+)/;
  private static ATTACHMENT_RELATIVE_PATH_REGEX =
    /^\/[^/]+\/richTextImageFields\/[^/]+\/[^/]+$/;
  private config: SalesforceConfig = {};
  private api: SalesforceApi;

  constructor() {
    super();

    this.api = new SalesforceApi();
  }

  public async initialize(
    config: SalesforceConfig,
    context: SalesforceContext,
  ): Promise<void> {
    await super.initialize(config, context);

    this.config = config;
    return this.api.initialize(config, context);
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
