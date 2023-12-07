import { SalesforceCategoryGroup } from './salesforce-category-group.js';

export interface SalesforceArticle {
  id: string;
  title: string;
  url: string;
  categoryGroups: SalesforceCategoryGroup[];
}
