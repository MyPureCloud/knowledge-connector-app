import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './document.js';

export interface Context<C, L, A> {
  processedItems: {
    categories: Category[];
    labels: Label[];
    documents: Document[];
  };
  unprocessedItems: {
    categories: C[];
    labels: L[];
    articles: A[];
  };
  unprocessableItems: {
    categories: C[];
    labels: L[];
    articles: A[];
  };
}
