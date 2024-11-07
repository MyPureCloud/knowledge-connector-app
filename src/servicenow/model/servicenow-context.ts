import { ServiceNowCategory } from './servicenow-category.js';
import { ServiceNowArticle } from './servicenow-article.js';
import { AdapterContext } from '../../adapter/adapter-context.js';

export interface ServiceNowContext
  extends AdapterContext<ServiceNowCategory, unknown, ServiceNowArticle> {
  categoryLookupTable: Record<string, ServiceNowCategory>;
  api?: ServiceNowApiContext;
}

export interface ServiceNowApiContext {
  categories: {
    done: boolean;
    nextOffset: number | null;
    unprocessed: ServiceNowCategory[];
  };
  articles: {
    done: boolean;
    nextOffset: number | null;
    unprocessed: ServiceNowArticle[];
  };
}
