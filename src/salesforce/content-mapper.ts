import { Document, DocumentVersion } from '../model/document.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceArticleLayoutItem } from './model/salesforce-article-layout-item.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { LabelReference } from '../model/label-reference.js';
import { Label } from '../model';
import { SalesforceMapperConfiguration } from './model/salesforce-mapper-configuration.js';
import { URLSearchParams } from 'url';
import { SalesforceContext } from './model/salesforce-context.js';
import { getLogger } from '../utils/logger.js';

const EXCLUDED_FIELD_NAMES = ['Title', 'UrlName'];
const EXCLUDED_FIELD_TYPES = ['DATE_TIME', 'LOOKUP', 'CHECKBOX'];

// Due to structural differences, Salesforce categories will be mapped to labels
export function categoryMapper(
  categoryGroup: SalesforceCategoryGroup,
): Label[] {
  return categoryGroup.topCategories.flatMap((category) =>
    categoryFlatter(categoryGroup.label, category),
  );
}

export function articleMapper(
  article: SalesforceArticleDetails,
  context: SalesforceContext,
  configuration: SalesforceMapperConfiguration,
): Document[] {
  const { id, title, categoryGroups, layoutItems } = article;

  replaceImageUrls(layoutItems);

  let labels: LabelReference[] | null = null;
  if (configuration.fetchLabels) {
    labels = categoryGroups.flatMap((categoryGroup) =>
      categoryGroup.selectedCategories.map((category) => {
        const name = getLabelByExternalId(
          category.url,
          context.labelLookupTable,
        )?.name;
        return { id: null, externalId: category.url, name: name! };
      }),
    );
  }

  const documentVersion: DocumentVersion = {
    visible: true,
    alternatives: null,
    title,
    variations: [
      {
        rawHtml: buildArticleBody(layoutItems, configuration.contentFields),
        body: null,
      },
    ],
    category: null,
    labels,
  };

  return [
    {
      id: null,
      externalId: String(id),
      externalUrl: configuration.buildExternalUrls
        ? buildExternalUrl(
            configuration.baseUrl,
            configuration.languageCode,
            article.urlName,
          )
        : null,
      published: documentVersion,
      draft: null,
    },
  ];
}

function categoryFlatter(
  ancestry: string,
  category: SalesforceCategory,
): Label[] {
  const name = `${ancestry}/${category.label}`;
  const labels: Label[] = [
    {
      id: null,
      externalId: category.url,
      name,
      color: GeneratedValue.COLOR,
    },
  ];
  if (category.childCategories && category.childCategories.length > 0) {
    category.childCategories.forEach((child) =>
      labels.push(...categoryFlatter(name, child)),
    );
  }

  return labels;
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
): boolean {
  return (
    (contentFields.length === 0 || contentFields.includes(item.name)) &&
    !EXCLUDED_FIELD_TYPES.includes(item.type) &&
    !EXCLUDED_FIELD_NAMES.includes(item.name)
  );
}

function buildExternalUrl(
  baseUrl?: string,
  language?: string,
  urlName?: string,
): string | null {
  if (!baseUrl || !language || !urlName) {
    return null;
  }

  return `${baseUrl}/articles/${language}/Knowledge/${urlName}`;
}

function getLabelByExternalId(
  externalId: string,
  labels: Record<string, LabelReference>,
): LabelReference | null {
  return labels[externalId] || null;
}

function replaceImageUrls(layoutItems: SalesforceArticleLayoutItem[]): void {
  layoutItems.forEach((item) => {
    if (item.type !== 'RICH_TEXT_AREA') {
      return;
    }

    const htmlString = item.value;
    const regex = /<img[^>]+?src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(htmlString)) !== null) {
      const imageUrl = match[1];
      const replacedImgUrl = processImageUrl(imageUrl, item.name);
      item.value = item.value.replace(imageUrl, replacedImgUrl);
    }
  });
}

function processImageUrl(url: string, fieldType: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.replace(/&amp;/g, '&'));
  } catch (error) {
    getLogger().debug(`Cannot process image URL ${url} - ${error}`);
    // Invalid URL, treat it as relative
    return url;
  }

  const searchParams = new URLSearchParams(parsedUrl.search);
  const eid = searchParams.get('eid');
  const refid = searchParams.get('refid');

  if (eid == null || refid == null) {
    return url;
  }

  return `/${eid}/richTextImageFields/${fieldType}/${refid}`;
}
