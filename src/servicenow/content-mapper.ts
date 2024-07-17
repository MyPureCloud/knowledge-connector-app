import { ExternalContent } from '../model/external-content.js';
import { Document, DocumentVersion } from '../model/sync-export-model.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Category } from '../model/category.js';
import { CategoryReference } from '../model/category-reference.js';
import { ExternalLink } from '../model/external-link.js';

export function contentMapper(
  articles: ServiceNowArticle[],
  fetchCategories: boolean,
): ExternalContent {
  return {
    categories: articles
      ? [
          ...new Map(
            articles
              .flatMap((a: ServiceNowArticle) => categoryMapper(a))
              .filter((c: Category | null): c is Category => !!c)
              .map((c: Category) => [c.externalId, c]),
          ).values(),
        ]
      : [],
    labels: [],
    documents: articles
      ? articles.map((a: ServiceNowArticle) =>
          articleMapper(a, fetchCategories),
        )
      : [],
    articleLookupTable: buildArticleLookupTable(articles),
  };
}

function categoryMapper(article: ServiceNowArticle): Category[] {
  return getCategoryWithParent(article);
}

function articleMapper(
  article: ServiceNowArticle,
  fetchCategories: boolean,
): Document {
  const id = article.id;
  const title = article.title;
  const body = article.fields.text.value;
  const state = article.fields.workflow_state.value;

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
    category: fetchCategories ? getCategoryReference(article) : null,
    labels: null,
  };

  return {
    id: null,
    externalId: String(id),
    published: state === 'published' ? documentVersion : null,
    draft: state !== 'published' ? documentVersion : null,
  };
}

function getCategory(article: ServiceNowArticle): {
  category?: Category;
  parent?: Category;
} {
  const categoryValue = article.fields?.category?.value ?? null;
  const categoryName = article.fields?.category?.display_value ?? null;
  const parentCategoryValue = article.fields?.topic?.value ?? null;
  const parentCategoryName = article.fields?.topic?.display_value ?? null;

  if (!categoryName && !parentCategoryName) {
    return {};
  }

  if (!categoryName && parentCategoryName) {
    return {
      category: {
        id: null,
        name: parentCategoryName,
        externalId: parentCategoryValue,
        parentCategory: null,
      },
    };
  }

  return {
    category: {
      id: null,
      name: categoryName,
      externalId: parentCategoryValue + categoryValue,
      parentCategory: {
        id: null,
        name: parentCategoryName,
      },
    },
    parent: {
      id: null,
      name: parentCategoryName,
      externalId: parentCategoryValue,
      parentCategory: null,
    },
  };
}

function getCategoryWithParent(article: ServiceNowArticle): Category[] {
  const { category, parent } = getCategory(article);

  return [category, parent].filter(
    (c: Category | undefined): c is Category => !!c,
  );
}

function getCategoryReference(
  article: ServiceNowArticle,
): CategoryReference | null {
  const { category } = getCategory(article);

  if (!category) {
    return null;
  }

  const { id, name } = category;
  return { id, name };
}

function buildArticleLookupTable(articles: ServiceNowArticle[]) {
  const lookupTable: Map<string, ExternalLink> = new Map<
    string,
    ExternalLink
  >();
  articles.forEach((article) => {
    if (article.number) {
      lookupTable.set(article.number, { externalDocumentId: article.id });
    }
  });
  return lookupTable;
}
