import { SalesforceCategory } from './salesforce-category.js';
import { SalesforceLabel } from './salesforce-label.js';
import { SalesforceArticle } from './salesforce-article.js';
import { SalesforceSection } from './salesforce-section.js';
import { SalesforceArticleAttachment } from './salesforce-article-attachment.js';
import { SalesforceIndividualArticle } from './salesforce-individual-article.js';

export interface SalesforceResponse {
  categories: SalesforceCategory[];
  labels: SalesforceLabel[];
  articles: SalesforceArticle[];
  article: SalesforceIndividualArticle[];
  sections: SalesforceSection[];
  article_attachments: SalesforceArticleAttachment[];
  nextPageUrl: string;
}
