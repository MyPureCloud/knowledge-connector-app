import { SalesforceCategoryGroup } from './salesforce-category-group.js';
import { SalesforceArticleLayoutItem } from './salesforce-article-layout-item.js';

export interface SalesforceArticleDetails {
  id: string;
  title: string;
  urlName: string;
  categoryGroups: SalesforceCategoryGroup[];
  layoutItems: SalesforceArticleLayoutItem[];
}
