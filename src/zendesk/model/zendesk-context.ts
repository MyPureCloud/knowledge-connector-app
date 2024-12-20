import { ZendeskCategory } from './zendesk-category.js';
import { ZendeskLabel } from './zendesk-label.js';
import { ZendeskArticle } from './zendesk-article.js';
import { AdapterContext } from '../../adapter/adapter-context.js';
import { ZendeskEntityTypes } from './zendesk-entity-types';
import { ZendeskSection } from './zendesk-section.js';
import { ZendeskArticleAttachment } from './zendest-article-attachment.js';

export interface ZendeskContext
  extends AdapterContext<ZendeskCategory, ZendeskLabel, ZendeskArticle> {
  categoryLookupTable: Record<string, ZendeskCategory>;
  api?: ZendeskApiContext;
}

export interface ZendeskApiContext {
  [ZendeskEntityTypes.CATEGORIES]: ZendeskSectionContext<ZendeskCategory>;
  [ZendeskEntityTypes.SECTIONS]: ZendeskSectionContext<ZendeskSection>;
  [ZendeskEntityTypes.LABELS]: ZendeskSectionContext<ZendeskLabel>;
  [ZendeskEntityTypes.ARTICLES]: ZendeskSectionContext<ZendeskArticle>;
  [ZendeskEntityTypes.ARTICLE_ATTACHMENTS]: ZendeskSectionContext<ZendeskArticleAttachment>;
}

export interface ZendeskSectionContext<T> {
  done: boolean;
  started: boolean;
  nextUrl: string | null;
  unprocessed: T[];
}
