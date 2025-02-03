import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';

export function categoryMapper(category: Category): Category {
  const { id, name, parentCategory } = category;

  return {
    id: null,
    externalId: String(id),
    name,
    parentCategory,
  };
}

export function labelMapper(label: Label): Label {
  const { id, name, color } = label;

  return {
    id: null,
    externalId: String(id),
    name,
    color,
  };
}

export function documentMapper(article: Document): Document {
  const { id, externalUrl, published, draft } = article;

  return {
    id: null,
    externalId: String(id),
    externalUrl,
    published,
    draft,
  };
}
