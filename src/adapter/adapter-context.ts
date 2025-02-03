import { Context } from '../context/context.js';
import { ExternalLink } from '../model/external-link.js';
import { CategoryReference, LabelReference } from '../model';

export interface AdapterContext<C, L, A> extends Context {
  adapter: {
    unprocessedItems: {
      categories: C[];
      labels: L[];
      articles: A[];
    };
  };
  categoryLookupTable: Record<string, CategoryReference>;
  labelLookupTable: Record<string, LabelReference>;
  articleLookupTable: Record<string, ExternalLink>;
}
