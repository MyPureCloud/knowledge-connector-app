import { SalesforceCategory } from './salesforce-category.js';

export interface SalesforceCategoryGroup {
  label: string;
  name: string;
  topCategories: SalesforceCategory[];
  selectedCategories: SalesforceCategory[];
}
