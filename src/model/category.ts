import { CategoryReference } from './category-reference.js';
import { NamedEntity } from './named-entity.js';

export interface Category extends NamedEntity {
  parentCategory: CategoryReference | null;
}
