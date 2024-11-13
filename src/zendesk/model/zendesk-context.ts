import { Context } from '../../model/context.js';
import { ZendeskCategory } from './zendesk-category.js';
import { ZendeskLabel } from './zendesk-label.js';
import { ZendeskArticle } from './zendesk-article.js';

export interface ZendeskContext
  extends Context<ZendeskCategory, ZendeskLabel, ZendeskArticle> {
  categoryLookupTable: Map<string, ZendeskCategory>;
}
