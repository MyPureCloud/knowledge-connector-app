import { ExternalContent } from '../model/external-content.js';
import { Document, DocumentVersion } from '../model/sync-export-model.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceArticleLayoutItem } from './model/salesforce-article-layout-item.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { LabelReference } from '../model/label-reference.js';
import { ExternalLink } from '../model/external-link.js';

const EXCLUDED_FIELD_TYPES = ['DATE_TIME', 'LOOKUP', 'CHECKBOX'];

export function contentMapper(
  categoryGroups: SalesforceCategoryGroup[],
  articles: SalesforceArticleDetails[],
  salesforceArticleContentFields: string[],
  fetchCategories: boolean,
): ExternalContent {
  const labelsMapping = buildIdAndNameMapping(categoryGroups);

  return {
    labels: Array.from(labelsMapping, ([key, value]) => ({
      id: null,
      externalId: key,
      name: value,
      color: GeneratedValue.COLOR,
    })),
    categories: [],
    documents: articles
      ? articles.map((a) =>
          articleMapper(
            a,
            labelsMapping,
            salesforceArticleContentFields,
            fetchCategories,
          ),
        )
      : [],
    articleLookupTable: buildArticleLookupTable(articles),
  };
}

function buildIdAndNameMapping(
  categoryGroups: SalesforceCategoryGroup[],
): Map<string, string> {
  const mapping = new Map<string, string>();
  categoryGroups.forEach((categoryGroup) =>
    labelMapper(categoryGroup, mapping),
  );

  return mapping;
}

// Due to structural differences, Salesforce categories will be mapped to labels
function labelMapper(
  categoryGroup: SalesforceCategoryGroup,
  labels: Map<string, string>,
): Map<string, string> {
  categoryGroup.topCategories.forEach((category) =>
    labelFlatter(categoryGroup.label, category, labels),
  );

  return labels;
}

function labelFlatter(
  ancestry: string,
  category: SalesforceCategory,
  labels: Map<string, string>,
) {
  const name = `${ancestry}/${category.label}`;
  labels.set(category.url, name);
  if (!category.childCategories || category.childCategories.length == 0) {
    return;
  }

  category.childCategories.forEach((child) =>
    labelFlatter(name, child, labels),
  );
}

function articleMapper(
  article: SalesforceArticleDetails,
  labelIdAndNameMapping: Map<string, string>,
  salesforceArticleContentFields: string[],
  fetchCategories: boolean,
): Document {
  const { id, title, categoryGroups, layoutItems } = article;

  let labels: LabelReference[] | null = null;
  if (fetchCategories) {
    labels = categoryGroups.flatMap((categoryGroup) =>
      categoryGroup.selectedCategories.map((category) => {
        const name = labelIdAndNameMapping.get(category.url);
        return { id: null, name: name! };
      }),
    );
  }

  const documentVersion: DocumentVersion = {
    visible: true,
    alternatives: null,
    title,
    variations: [
      {
        rawHtml: buildArticleBody(layoutItems, salesforceArticleContentFields),
        body: null,
      },
    ],
    category: null,
    labels: labels,
  };

  return {
    id: null,
    externalId: String(id),
    published: documentVersion,
    draft: null,
  };
}

function buildArticleBody(
  articleItems: SalesforceArticleLayoutItem[],
  contentFields: string[],
): string {
  const contentParts: string[] = articleItems
    .filter((item) => filterField(item, contentFields))
    .map((item) => item.value);

  return `<p>${contentParts.join('</p><p>')}</p>`;
}

function filterField(
  item: SalesforceArticleLayoutItem,
  contentFields: string[],
) {
  return (
    (contentFields.length === 0 || contentFields.includes(item.name)) &&
    !EXCLUDED_FIELD_TYPES.includes(item.type)
  );
}

function buildArticleLookupTable(articles: SalesforceArticleDetails[]) {
  const lookupTable: Map<string, ExternalLink> = new Map<
    string,
    ExternalLink
  >();
  articles.forEach((article) => {
    if (article.urlName) {
      lookupTable.set(article.urlName, { externalDocumentId: article.id });
    }
  });
  return lookupTable;
}
