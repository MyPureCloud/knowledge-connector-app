import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Adapter } from '../adapter/adapter.js';
import { Image } from '../model';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskCategory } from './model/zendesk-category.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskAdapter } from './zendesk-adapter.js';
import { ZendeskLoader } from './zendesk-loader.js';
import {
  generateNormalizedCategory,
  generateNormalizedLabel,
  generateRawDocument,
} from '../tests/utils/entity-generators.js';
import { ExternalLink } from '../model/external-link.js';

const mockGetAllArticles = jest.fn<() => Promise<ZendeskArticle[]>>();
const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockGetAllCategories = jest.fn<() => Promise<ZendeskCategory[]>>();
const mockGetAllLabels = jest.fn<() => Promise<ZendeskLabel[]>>();

describe('ZendeskLoader', () => {
  const LABEL = generateNormalizedLabel('', null, 'label-name');
  const CATEGORY = generateNormalizedCategory(
    '',
    null,
    'category-name',
    'category-external-id',
  );
  const DOCUMENT = generateRawDocument(
    'article-body',
    {
      id: 'category-external-id',
      name: 'category-name',
    },
    [
      {
        id: null,
        name: 'label-name',
      },
    ],
  );

  let config: ZendeskConfig;
  let adapter: ZendeskAdapter;
  let loader: ZendeskLoader;

  beforeEach(async () => {
    config = {};
    adapter = new ZendeskAdapter();
    loader = new ZendeskLoader();

    mockGetAllArticles.mockResolvedValueOnce([generateLoadedArticle()]);
    mockGetAllCategories.mockResolvedValueOnce([generateLoadedCategory()]);
    mockGetAllLabels.mockResolvedValueOnce([generateLoadedLabel()]);
  });

  describe('run', () => {
    beforeEach(async () => {
      await loader.initialize(config, {
        sourceAdapter: adapter,
        destinationAdapter: {} as Adapter,
      });
    });

    it('should fetch articles, categories and labels', async () => {
      await loader.run();

      expect(mockGetAllArticles).toHaveBeenCalled();
      expect(mockGetAllCategories).toHaveBeenCalled();
      expect(mockGetAllLabels).toHaveBeenCalled();
    });

    it('should map entities', async () => {
      const result = await loader.run();

      expect(result).toEqual({
        labels: [LABEL],
        documents: [DOCUMENT],
        categories: [CATEGORY],
        articleLookupTable: new Map<string, ExternalLink>(),
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
          labels: [LABEL],
          documents: [
            generateRawDocument('article-body', null, [
              {
                id: null,
                name: 'label-name',
              },
            ]),
          ],
          categories: [],
          articleLookupTable: new Map<string, ExternalLink>(),
        });
        expect(mockGetAllCategories).not.toHaveBeenCalled();
      });
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
        const result = await loader.run();

        expect(result).toEqual({
          labels: [],
          documents: [
            generateRawDocument(
              'article-body',
              {
                id: 'category-external-id',
                name: 'category-name',
              },
              null,
            ),
          ],
          categories: [CATEGORY],
          articleLookupTable: new Map<string, ExternalLink>(),
        });
        expect(mockGetAllLabels).not.toHaveBeenCalled();
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
          categories: [CATEGORY],
          articleLookupTable: new Map<string, ExternalLink>(),
        });
        expect(mockGetAllArticles).not.toHaveBeenCalled();
      });
    });
  });
});

jest.mock('./zendesk-adapter.js', () => {
  return {
    ZendeskAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: ZendeskConfig) => Promise<void>>(),
        getAllArticles: () => mockGetAllArticles(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
        getAllCategories: () => mockGetAllCategories(),
        getAllLabels: () => mockGetAllLabels(),
      };
    }),
  };
});

function generateLoadedArticle(): ZendeskArticle {
  return {
    id: 'article-external-id',
    title: 'article-title',
    body: 'article-body',
    draft: false,
    section_id: 'category-external-id',
    label_names: ['label-name'],
  };
}

function generateLoadedCategory(): ZendeskCategory {
  return {
    id: 'category-external-id',
    name: 'category-name',
  };
}

function generateLoadedLabel(): ZendeskLabel {
  return {
    id: 'label-external-id',
    name: 'label-name',
  };
}
