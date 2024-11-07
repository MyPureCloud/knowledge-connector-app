import { Context } from '../../model/context.js';
import { ServiceNowCategory } from './servicenow-category.js';
import { ServiceNowArticle } from './servicenow-article.js';
import { ExternalLink } from '../../model/external-link';

export interface ServiceNowContext
  extends Context<ServiceNowCategory, unknown, ServiceNowArticle> {
  articleLookupTable: Map<string, ExternalLink>;
  categoryLookupTable: Map<string, ServiceNowCategory>;
}
