import { ServiceNowArticle } from './servicenow-article.js';

export interface ServiceNowArticleResponse {
  result: {
    meta: {
      count: number;
      start: number;
      end: number;
    };
    articles: ServiceNowArticle[];
  };
}
