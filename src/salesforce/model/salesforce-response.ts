import { SalesforceArticle } from './salesforce-article.js';
import { SalesforceCategoryGroup } from './salesforce-category-group.js';
import { SalesforceCategory } from './salesforce-category.js';

export interface SalesforceResponse {
  articles: SalesforceArticle[];
  categoryGroups: SalesforceCategoryGroup[];
  childCategories: SalesforceCategory[];
  label: string;
  name: string;
  nextPageUrl: string;
}
