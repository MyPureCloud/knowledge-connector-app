import { ZendeskCategory } from './zendesk-category.js';

export interface ZendeskSection extends ZendeskCategory {
  parent_section_id?: string;
  category_id?: string;
}
