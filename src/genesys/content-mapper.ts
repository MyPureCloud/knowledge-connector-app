import { ExternalContent } from '../model/external-content.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/sync-export-model.js';

export function contentMapper(
  categories: Category[],
  labels: Label[],
  documents: Document[],
): ExternalContent {
  return {
    categories: categories ? categories.map(categoryMapper) : [],
    labels: labels ? labels.map(labelMapper) : [],
    documents: documents ? documents.map(documentMapper) : [],
  };
}

function categoryMapper(category: Category): Category {
  const { id, name, parentCategory } = category;

  return {
    id: null,
    externalId: String(id),
    name,
    parentCategory,
  };
}

function labelMapper(label: Label): Label {
  const { id, name, color } = label;

  return {
    id: null,
    externalId: String(id),
    name,
    color,
  };
}

function documentMapper(article: Document): Document {
  const { id, published, draft } = article;

  return {
    id: null,
    externalId: String(id),
    published,
    draft,
  };
}
