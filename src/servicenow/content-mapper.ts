import { Document, DocumentVersion } from '../model/document.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Category } from '../model/category.js';
import { CategoryReference } from '../model/category-reference.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowMapperConfiguration } from './model/servicenow-mapper-configuration.js';

export function categoryMapper(
  category: ServiceNowCategory,
  context: ServiceNowContext,
): Category | null {
  const {
    sys_id: externalId,
    full_category: name,
    parent_id: parent,
  } = category;

  const parentCategory =
    parent && parent.value
      ? context.categoryLookupTable.get(parent.value)
      : null;
  if (parentCategory === undefined) {
    // Parent is not yet processed
    return null;
  }

  return {
    id: null,
    name,
    externalId,
    parentCategory: parentCategory
      ? { id: null, name: parentCategory.full_category }
      : null,
  };
}

export function articleMapper(
  article: ServiceNowArticle,
  configuration: ServiceNowMapperConfiguration,
): Document {
  const {
    id,
    title,
    fields: {
      text: { value: body },
      workflow_state: { value: state },
    },
  } = article;

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
    category: configuration.fetchCategories
      ? getCategoryReference(article)
      : null,
    labels: null,
  };

  return {
    id: null,
    externalId: String(id),
    externalUrl: configuration.buildExternalUrls
      ? buildExternalUrl(configuration.baseUrl, article.number)
      : null,
    published: state === 'published' ? documentVersion : null,
    draft: state !== 'published' ? documentVersion : null,
  };
}

function getCategoryReference(
  article: ServiceNowArticle,
): CategoryReference | null {
  if (!article.fields.kb_category?.value) {
    return null;
  }

  return { id: null, name: article.fields.kb_category?.display_value };
}

function buildExternalUrl(
  baseUrl?: string,
  articleNumber?: string,
): string | null {
  if (!baseUrl || !articleNumber) {
    return null;
  }

  return `${baseUrl}/kb_view.do?sysparm_article=${articleNumber}`;
}
