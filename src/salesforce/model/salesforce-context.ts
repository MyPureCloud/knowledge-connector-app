import { Context } from '../../model/context.js';
import { SalesforceCategoryGroup } from './salesforce-category-group.js';
import { SalesforceArticleDetails } from './salesforce-article-details.js';
import { ExternalLink } from '../../model/external-link.js';
import { Label } from '../../model';

export interface SalesforceContext
  extends Context<SalesforceCategoryGroup, unknown, SalesforceArticleDetails> {
  articleLookupTable: Map<string, ExternalLink>;
  labelLookupTable: Map<string, Label>;
}
