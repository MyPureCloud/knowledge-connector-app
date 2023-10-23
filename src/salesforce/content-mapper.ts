import { SalesforceLabel } from './model/salesforce-label.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { ExternalContent } from '../model/external-content.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { SalesforceSection } from './model/salesforce-section.js';
import { Document, DocumentVersion } from '../model/import-export-model.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { GeneratedValue } from '../utils/generated-value.js';

export function contentMapper(
  categories: SalesforceSection[],
  labels: SalesforceLabel[],
  articles: SalesforceArticle[],
): ExternalContent {
  const sectionIdAndNameMapping = buildIdAndNameMapping(categories);

  return {
    categories: categories
      ? categories.map((c) => categoryMapper(c, sectionIdAndNameMapping))
      : [],
    labels: labels ? labels.map(labelMapper) : [],
    documents: articles
      ? articles.map((a) => articleMapper(a, sectionIdAndNameMapping))
      : [],
  };
}

function categoryMapper(
  category: SalesforceSection,
  idAndNameMapping: Map<string, string>,
): Category {
  const { id, name, category_id, parent_section_id } = category;

  const parentName =
    parent_section_id || category_id
      ? idAndNameMapping.get((parent_section_id || category_id)!)
      : null;

  return {
    id: null,
    externalId: String(id),
    name,
    parentCategory: parentName
      ? {
          id: null,
          name: parentName,
        }
      : null,
  };
}

function labelMapper(label: SalesforceLabel): Label {
  const { id, name } = label;

  return {
    id: null,
    externalId: String(id),
    name,
    color: GeneratedValue.COLOR,
  };
}

function articleMapper(
  article: SalesforceArticle,
  sectionIdAndNameMapping: Map<string, string>,
): Document {
  const { id, title, body, draft, section_id, label_names } = article;
  const sectionName = section_id
    ? sectionIdAndNameMapping.get(section_id)
    : null;

  const documentVersion: DocumentVersion = {
    visible: true,
    title,
    variations: [
      {
        rawHtml: `<p>${body}</p>`,
        body: null,
      },
    ],
    category: sectionName
      ? {
          id: null,
          name: sectionName,
        }
      : null,
    labels:
      label_names?.map((label) => ({
        id: null,
        name: String(label),
      })) || null,
  };

  return {
    id: null,
    externalId: String(id),
    published: !draft ? documentVersion : null,
    draft: draft ? documentVersion : null,
  };
}

function buildIdAndNameMapping(items: SalesforceCategory[]): Map<string, string> {
  const mapping = new Map<string, string>();

  if (items) {
    items.forEach((item) => {
      if (item.id && item.name) {
        mapping.set(item.id, item.name);
      }
    });
  }

  return mapping;
}
