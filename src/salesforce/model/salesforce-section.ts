import { SalesforceCategory } from './salesforce-category.js';

export interface SalesforceSection extends SalesforceCategory {
  parent_section_id?: string;
  category_id?: string;
}
