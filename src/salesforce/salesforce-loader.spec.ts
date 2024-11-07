import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Adapter } from '../adapter/adapter.js';
import { Image } from '../model';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceLoader } from './salesforce-loader.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { generateRawDocument } from '../tests/utils/entity-generators.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { arraysFromAsync } from '../utils/arrays';

const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockCategoryIterator =
  jest.fn<() => AsyncGenerator<SalesforceCategoryGroup, void, void>>();
const mockLabelIterator = jest.fn<() => AsyncGenerator<unknown, void, void>>();
const mockArticleIterator =
  jest.fn<() => AsyncGenerator<SalesforceArticleDetails, void, void>>();
const mockGetResourceBaseUrl = jest.fn<() => Promise<unknown[]>>();

describe('SalesforceLoader', () => {
  const LABEL = generateMappedLabel();
  const DOCUMENT = generateRawDocument(
    '<p><img src="https://document-image.url"></p>',
    null,
    [
      {
        id: null,
        name: 'category-group-label/category-label',
      },
    ],
  );

  let config: SalesforceConfig;
  let adapter: SalesforceAdapter;
  let loader: SalesforceLoader;

  beforeEach(async () => {
    config = {
      salesforceLoginUrl: 'https://login-url',
      salesforceApiVersion: 'v56.0',
      salesforceClientId: 'client-id',
      salesforceClientSecret: 'client-secret',
      salesforceLanguageCode: 'en-US',
      salesforceUsername: 'username',
      salesforcePassword: 'password',
    };
    adapter = new SalesforceAdapter();
    loader = new SalesforceLoader();

    mockArticleIterator.mockImplementation(articleIterator);
    mockCategoryIterator.mockImplementation(categoryIterator);
    mockGetResourceBaseUrl.mockResolvedValueOnce([
      () => 'https://salesforce.com',
    ]);
  });

  describe('run', () => {
    beforeEach(async () => {
      await loader.initialize(config, {
        sourceAdapter: adapter,
        destinationAdapter: {} as Adapter,
      });
    });

    it('should map labels', async () => {
      const { value } = await loader.labelIterator().next();

      expect(value).toEqual(LABEL);
    });

    it('should map documents', async () => {
      await loader.labelIterator().next();

      const { value } = await loader.documentIterator().next();

      expect(value).toEqual(DOCUMENT);
    });

    describe('when labels excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchLabels: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave labels empty', async () => {
        const result = await arraysFromAsync(loader.categoryIterator());

        expect(result.length).toBe(0);
      });
    });

    describe('when articles excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchArticles: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave documents empty', async () => {
        const result = await arraysFromAsync(loader.documentIterator());

        expect(result.length).toBe(0);
      });
    });
  });
});

jest.mock('./salesforce-adapter.js', () => {
  return {
    SalesforceAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: SalesforceConfig) => Promise<void>>(),
        articleIterator: () => mockArticleIterator(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
        categoryIterator: () => mockCategoryIterator(),
        labelIterator: () => mockLabelIterator(),
        getResourceBaseUrl: () => mockGetResourceBaseUrl(),
      };
    }),
  };
});

async function* articleIterator(): AsyncGenerator<
  SalesforceArticleDetails,
  void,
  void
> {
  yield generateArticle();
}

function generateArticle(): SalesforceArticleDetails {
  return {
    id: 'article-external-id',
    title: 'article-title',
    urlName: 'testUrlName',
    categoryGroups: [
      {
        label: 'category-group-label',
        name: 'category-group-name',
        topCategories: [],
        selectedCategories: [
          {
            label: 'category-label',
            name: 'category-name',
            url: 'category-url',
          },
        ],
      },
    ],
    layoutItems: [
      {
        type: 'RICH_TEXT_AREA',
        value: '<img src="https://document-image.url">',
        label: '',
        name: '',
      },
    ],
  };
}

async function* categoryIterator(): AsyncGenerator<
    SalesforceCategoryGroup,
    void,
    void
> {
    yield generateCategory();
}


function generateCategory(): SalesforceCategoryGroup {
  return {
    label: 'category-group-label',
    name: 'category-group-name',
    topCategories: [
      {
        childCategories: [],
        label: 'category-label',
        name: 'category-name',
        url: 'category-url',
      },
    ],
    selectedCategories: [],
  };
}

function generateMappedLabel() {
  return {
    color: 'generated-value-color',
    externalId: 'category-url',
    id: null,
    name: 'category-group-label/category-label',
  };
}
