import { ZendeskCategory } from './zendesk-category.js';
import { ZendeskLabel } from './zendesk-label.js';
import { ZendeskArticle } from './zendesk-article.js';
import { AdapterContext } from '../../adapter/adapter-context.js';

export interface ZendeskContext
  extends AdapterContext<ZendeskCategory, ZendeskLabel, ZendeskArticle> {
  categoryLookupTable: Record<string, ZendeskCategory>;
}
