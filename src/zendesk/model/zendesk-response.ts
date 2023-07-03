import { ZendeskCategory } from './zendesk-category.js';
import { ZendeskLabel } from './zendesk-label.js';
import { ZendeskArticle } from './zendesk-article.js';
import { ZendeskSection } from './zendesk-section.js';
import { ZendeskArticleAttachment } from './zendest-article-attachment.js';

export interface ZendeskResponse {
  categories: ZendeskCategory[];
  labels: ZendeskLabel[];
  articles: ZendeskArticle[];
  sections: ZendeskSection[];
  article_attachments: ZendeskArticleAttachment[];
  next_page: string;
}
