import { Context } from '../context/context.js';
import { ExternalLink } from '../model/external-link.js';

export interface AdapterContext<C, L, A> extends Context {
  adapter: {
    unprocessedItems: {
      categories: C[];
      labels: L[];
      articles: A[];
    };
  };
  articleLookupTable: Record<string, ExternalLink>;
}
