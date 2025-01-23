import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { Document, DocumentVersion } from '../model/document.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { ZendeskContext } from './model/zendesk-context.js';
import { LabelReference } from '../model';

export function categoryMapper(
  category: ZendeskSection,
  context: ZendeskContext,
): Category[] {
  const { id, name, category_id, parent_section_id } = category;

  const parentId =
    !!parent_section_id || !!category_id
      ? String(parent_section_id || category_id)
      : undefined;

  const parentCategory = parentId
    ? context.categoryLookupTable[parentId]
    : null;
  if (parentCategory === undefined) {
    // Parent is not yet processed
    return [];
  }

  return [
    {
      id: null,
      externalId: `${id}`,
      name,
      parentCategory: parentCategory
        ? {
            id: null,
            externalId: parentCategory.externalId,
            name: parentCategory.name,
          }
        : null,
    },
  ];
}

export function labelMapper(label: ZendeskLabel): Label[] {
  const { id, name } = label;

  return [
    {
      id: null,
      externalId: String(id),
      name,
      color: GeneratedValue.COLOR,
    },
  ];
}

export function articleMapper(
  article: ZendeskArticle,
  context: ZendeskContext,
  fetchCategories: boolean,
  fetchLabels: boolean,
): Document[] {
  const { id, title, body, draft, section_id, label_names } = article;

  const categoryId = String(section_id);

  const category =
    fetchCategories && section_id
      ? {
          id: null,
          externalId: categoryId,
          name: context.categoryLookupTable[categoryId]?.name || categoryId,
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
      ? label_names
          ?.map((name) => mapLabelName(name, context.labelLookupTable))
          .filter((l) => !!l) || null
      : null,
  };

  return [
    {
      id: null,
      externalId: String(id),
      externalUrl: null,
      published: !draft ? documentVersion : null,
      draft: draft ? documentVersion : null,
    },
  ];
}

function mapLabelName(
  name: string,
  lookupTable: Record<string, LabelReference>,
): LabelReference | null {
  const label = lookupTable[name];
  if (label) {
    return label;
  }

  return null;
}
