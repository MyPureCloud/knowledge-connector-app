import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ExternalContent } from '../model/external-content.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { Document, DocumentVersion } from '../model/sync-export-model.js';
import { ZendeskCategory } from './model/zendesk-category.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { ExternalLink } from '../model/external-link.js';

export function contentMapper(
  categories: ZendeskSection[],
  labels: ZendeskLabel[],
  articles: ZendeskArticle[],
  fetchCategories: boolean,
  fetchLabels: boolean,
): ExternalContent {
  const sectionIdAndNameMapping = buildIdAndNameMapping(categories);

  return {
    categories: categories
      ? categories.map((c) => categoryMapper(c, sectionIdAndNameMapping))
      : [],
    labels: labels ? labels.map(labelMapper) : [],
    documents: articles
      ? articles.map((a) =>
          articleMapper(
            a,
            sectionIdAndNameMapping,
            fetchCategories,
            fetchLabels,
          ),
        )
      : [],
    articleLookupTable: buildArticleLookupTable(articles),
  };
}

function categoryMapper(
  category: ZendeskSection,
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

function labelMapper(label: ZendeskLabel): Label {
  const { id, name } = label;

  return {
    id: null,
    externalId: String(id),
    name,
    color: GeneratedValue.COLOR,
  };
}

function articleMapper(
  article: ZendeskArticle,
  sectionIdAndNameMapping: Map<string, string>,
  fetchCategories: boolean,
  fetchLabels: boolean,
): Document {
  const { id, title, body, draft, section_id, label_names } = article;

  const sectionName = section_id
    ? sectionIdAndNameMapping.get(section_id)
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
    category:
      fetchCategories && sectionName
        ? {
            id: null,
            name: sectionName,
          }
        : null,
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
    published: !draft ? documentVersion : null,
    draft: draft ? documentVersion : null,
  };
}

function buildIdAndNameMapping(items: ZendeskCategory[]): Map<string, string> {
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

function buildArticleLookupTable(_articles: ZendeskArticle[]) {
  // TODO
  return new Map<string, ExternalLink>();
}
