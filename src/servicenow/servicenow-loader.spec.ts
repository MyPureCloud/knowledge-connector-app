import { ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ServiceNowLoader } from './servicenow-loader.js';
import { Adapter } from '../adapter/adapter.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Image } from '../model';
import {
  generateNormalizedCategory,
  generateRawDocument,
} from '../tests/utils/entity-generators';
import { ExternalLink } from '../model/external-link';

const mockGetAllArticles = jest.fn<() => Promise<ServiceNowArticle[]>>();
const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockGetAllCategories = jest.fn<() => Promise<unknown[]>>();
const mockGetAllLabels = jest.fn<() => Promise<unknown[]>>();

describe('ServiceNowLoader', () => {
  const CATEGORY = generateNormalizedCategory(
    '',
    null,
    'category-display-value',
    'topic-valuecategory-value',
    {
      id: null,
      name: 'topic-display-value',
    },
  );
  const TOPIC = generateNormalizedCategory(
    '',
    null,
    'topic-display-value',
    'topic-value',
  );
  const DOCUMENT = generateRawDocument('<p>article body</p>', {
    id: null,
    name: 'category-display-value',
  });

  let config: ServiceNowConfig;
  let adapter: ServiceNowAdapter;
  let loader: ServiceNowLoader;

  beforeEach(async () => {
    config = {
      servicenowUsername: 'user',
      servicenowPassword: 'password',
      servicenowBaseUrl: 'https://test-url.com',
    };
    adapter = new ServiceNowAdapter();
    loader = new ServiceNowLoader();

    mockGetAllArticles.mockResolvedValueOnce([generateArticle()]);
  });

  describe('run', () => {
    beforeEach(async () => {
      await loader.initialize(config, {
        sourceAdapter: adapter,
        destinationAdapter: {} as Adapter,
      });
    });

    it('should fetch articles only', async () => {
      await loader.run();

      expect(mockGetAllArticles).toHaveBeenCalled();
      expect(mockGetAllLabels).not.toHaveBeenCalled();
      expect(mockGetAllCategories).not.toHaveBeenCalled();
    });

    it('should map entities', async () => {
      const result = await loader.run();

      expect(result).toEqual({
        labels: [],
        documents: [DOCUMENT],
        categories: [CATEGORY, TOPIC],
        articleLookupTable: new Map<string, ExternalLink>([
          ['article-number', { externalDocumentId: 'article-external-id' }],
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

      it('should leave categories empty', async () => {
        const result = await loader.run();

        expect(result).toEqual({
          labels: [],
          documents: [generateRawDocument('<p>article body</p>')],
          categories: [],
          articleLookupTable: new Map<string, ExternalLink>([
            ['article-number', { externalDocumentId: 'article-external-id' }],
          ]),
        });
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
          labels: [],
          documents: [],
          categories: [CATEGORY, TOPIC],
          articleLookupTable: new Map<string, ExternalLink>(),
        });
      });
    });
  });
});

jest.mock('./servicenow-adapter.js', () => {
  return {
    ServiceNowAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: ServiceNowConfig) => Promise<void>>(),
        getAllArticles: () => mockGetAllArticles(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
        getAllCategories: () => mockGetAllCategories(),
        getAllLabels: () => mockGetAllLabels(),
      };
    }),
  };
});

function generateArticle(): ServiceNowArticle {
  return {
    link: 'article-link',
    id: 'article-external-id',
    title: 'article-title',
    snippet: 'article-snippet',
    number: 'article-number',
    fields: {
      category: {
        name: 'category-name',
        value: 'category-value',
        display_value: 'category-display-value',
      },
      topic: {
        name: 'topic-name',
        value: 'topic-value',
        display_value: 'topic-display-value',
      },
      text: {
        value: '<p>article body</p>',
      },
      workflow_state: {
        value: 'published',
      },
    },
  };
}
