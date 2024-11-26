import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Adapter } from '../adapter/adapter.js';
import { Image } from '../model';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceLoader } from './salesforce-loader.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { generateRawDocument } from '../tests/utils/entity-generators.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { ExternalLink } from '../model/external-link.js';

const mockGetAllArticles = jest.fn<() => Promise<SalesforceArticleDetails[]>>();
const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockGetAllCategories =
  jest.fn<() => Promise<SalesforceCategoryGroup[]>>();
const mockGetAllLabels = jest.fn<() => Promise<unknown[]>>();
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

    mockGetAllArticles.mockResolvedValueOnce([generateArticle()]);
    mockGetAllCategories.mockResolvedValueOnce([generateCategory()]);
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

    it('should fetch articles and categories only', async () => {
      await loader.run();

      expect(mockGetAllArticles).toHaveBeenCalled();
      expect(mockGetAllCategories).toHaveBeenCalled();
      expect(mockGetAllLabels).not.toHaveBeenCalled();
    });

    it('should map entities', async () => {
      const result = await loader.run();

      expect(result).toEqual({
        labels: [LABEL],
        documents: [DOCUMENT],
        categories: [],
        articleLookupTable: new Map<string, ExternalLink>([
          [
            'testUrlName',
            {
              externalDocumentId: 'article-external-id',
            },
          ],
        ]),
      });
    });

    describe('when categories excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchCategories: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave labels (=categories) empty', async () => {
        const result = await loader.run();

        expect(result).toEqual({
          labels: [],
          documents: [
            generateRawDocument(
              '<p><img src="https://document-image.url"></p>',
              null,
              null,
            ),
          ],
          categories: [],
          articleLookupTable: new Map<string, ExternalLink>([
            ['testUrlName', { externalDocumentId: 'article-external-id' }],
          ]),
        });
        expect(mockGetAllCategories).not.toHaveBeenCalled();
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
        const result = await loader.run();

        expect(result).toEqual({
          labels: [LABEL],
          documents: [],
          categories: [],
          articleLookupTable: new Map<string, ExternalLink>(),
        });
        expect(mockGetAllArticles).not.toHaveBeenCalled();
      });
    });
  });
});

jest.mock('./salesforce-adapter.js', () => {
  return {
    SalesforceAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: SalesforceConfig) => Promise<void>>(),
        getAllArticles: () => mockGetAllArticles(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
        getAllCategories: () => mockGetAllCategories(),
        getAllLabels: () => mockGetAllLabels(),
        getResourceBaseUrl: () => mockGetResourceBaseUrl(),
      };
    }),
  };
});

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
