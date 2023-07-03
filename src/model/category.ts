import { ExternalIdentifiable } from './external-identifiable.js';
import { CategoryReference } from './category-reference.js';

export interface Category extends ExternalIdentifiable {
  name: string | null;
  parentCategory: CategoryReference | null;
}
