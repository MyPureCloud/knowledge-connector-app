import { Document, DocumentVersion } from '../model/document.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Category } from '../model/category.js';
import { CategoryReference } from '../model/category-reference.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowMapperConfiguration } from './model/servicenow-mapper-configuration.js';
import { MissingReferenceError } from '../utils/errors/missing-reference-error.js';
import { EntityType } from '../model/entity-type.js';

export function categoryMapper(
  category: ServiceNowCategory,
  context: ServiceNowContext,
): Category[] {
  const {
    sys_id: externalId,
    full_category: name,
    parent_id: parent,
  } = category;

  let parentCategory: CategoryReference | null;
  if (
    !parent?.value ||
    parent?.link.includes(`api/now/table/kb_knowledge_base/${parent?.value}`)
  ) {
    parentCategory = null;
  } else {
    parentCategory = context.categoryLookupTable[parent.value];
    if (!parentCategory) {
      // Parent is not yet processed
      return [];
    }
  }

  return [
    {
      id: null,
      name,
      externalId,
      parentCategory: parentCategory,
    },
  ];
}

export function articleMapper(
  article: ServiceNowArticle,
  configuration: ServiceNowMapperConfiguration,
  context: ServiceNowContext,
): Document[] {
  const { categoryLookupTable } = context;

  const {
    id,
    number,
    title,
    fields: {
      text: { value: body },
      workflow_state: { value: state },
      sys_updated_on: { value: updatedOn },
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
      ? getCategoryReference(article, categoryLookupTable)
      : null,
    labels: null,
  };

  return [
    {
      id: null,
      externalId: `${number}`,
      externalIdAlternatives: [`${id}`],
      externalUrl: configuration.buildExternalUrls
        ? buildExternalUrl(configuration.baseUrl, article.number)
        : null,
      externalVersionId: updatedOn ?? null,
      published: state === 'published' ? documentVersion : null,
      draft: state !== 'published' ? documentVersion : null,
    },
  ];
}

function getCategoryReference(
  article: ServiceNowArticle,
  categoryLookupTable: Record<string, CategoryReference>,
): CategoryReference | null {
  if (!article.fields.kb_category?.value) {
    return null;
  }

  const category = categoryLookupTable[article.fields.kb_category.value];
  if (!category) {
    throw new MissingReferenceError(
      EntityType.CATEGORY,
      article.fields.kb_category?.value,
    );
  }

  return category;
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
