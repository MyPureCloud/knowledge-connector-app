import { ServiceNowArticle } from './servicenow-article.js';

export interface ServiceNowResponse {
  result: {
    meta: {
      count: number;
      start: number;
      end: number;
    }
    articles: ServiceNowArticle[];
  }
}
