import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { Document, DocumentVersion } from '../model/document.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { ZendeskContext } from './model/zendesk-context.js';

export function categoryMapper(
  category: ZendeskSection,
  context: ZendeskContext,
): Category | null {
  const { id, name, category_id, parent_section_id } = category;

  const parentId =
    !!parent_section_id || !!category_id
      ? String(parent_section_id || category_id)
      : undefined;

  const parentCategory = parentId
    ? context.categoryLookupTable.get(parentId)
    : null;
  if (parentCategory === undefined) {
    // Parent is not yet processed
    return null;
  }

  return {
    id: null,
    externalId: String(id),
    name,
    parentCategory: parentCategory
      ? {
          id: null,
          name: parentCategory.name,
        }
      : null,
  };
}

export function labelMapper(label: ZendeskLabel): Label {
  const { id, name } = label;

  return {
    id: null,
    externalId: String(id),
    name,
    color: GeneratedValue.COLOR,
  };
}

export function articleMapper(
  article: ZendeskArticle,
  context: ZendeskContext,
  fetchCategories: boolean,
  fetchLabels: boolean,
): Document {
  const { id, title, body, draft, section_id, label_names } = article;

  const categoryId = String(section_id);

  const category =
    fetchCategories && section_id
      ? {
          id: categoryId,
          name: context.categoryLookupTable.get(categoryId)?.name || categoryId,
        }
      : null;

  const documentVersion: DocumentVersion = {
    visible: true,
    alternatives: null,
    title,
    variations: [
      {
        rawHtml: body,
        body: null,
      },
    ],
    category,
    labels: fetchLabels
      ? label_names?.map((label) => ({
          id: null,
          name: String(label),
        })) || null
      : null,
  };

  return {
    id: null,
    externalId: String(id),
    externalUrl: null,
    published: !draft ? documentVersion : null,
    draft: draft ? documentVersion : null,
  };
}
