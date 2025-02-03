import { SalesforceCategoryGroup } from './salesforce-category-group.js';
import { SalesforceArticleDetails } from './salesforce-article-details.js';
import { AdapterContext } from '../../adapter/adapter-context.js';
import { SalesforceArticle } from './salesforce-article.js';
import { SalesforceEntityTypes } from './salesforce-entity-types.js';

export interface SalesforceContext
  extends AdapterContext<
    SalesforceCategoryGroup,
    unknown,
    SalesforceArticleDetails
  > {
  api?: SalesforceApiContext;
}

export interface SalesforceApiContext {
  [SalesforceEntityTypes.CATEGORY_GROUPS]: SalesforceSectionContext<SalesforceCategoryGroup>;
  [SalesforceEntityTypes.ARTICLES]: SalesforceSectionContext<SalesforceArticle>;
}

export interface SalesforceSectionContext<T> {
  done: boolean;
  started: boolean;
  nextUrl: string | null;
  unprocessed: T[];
}
