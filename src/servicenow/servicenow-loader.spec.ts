import { ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ServiceNowLoader } from './servicenow-loader.js';
import { Adapter } from '../adapter/adapter.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { Document, Image } from '../model';
import {
  generateNormalizedCategory,
  generateRawDocument,
} from '../tests/utils/entity-generators.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { arraysFromAsync } from '../utils/arrays.js';

const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockCategoryIterator =
  jest.fn<() => AsyncGenerator<ServiceNowCategory, void, void>>();
const mockLabelIterator = jest.fn<() => AsyncGenerator<unknown, void, void>>();
const mockArticleIterator =
  jest.fn<() => AsyncGenerator<ServiceNowArticle, void, void>>();

const CATEGORY_EXTERNAL_ID = 'category-external-id';
const CATEGORY_NAME = 'category-name';
const PARENT_CATEGORY_EXTERNAL_ID = 'parent-category-external-id';
const PARENT_CATEGORY_NAME = 'parent-category-name';

describe('ServiceNowLoader', () => {
  const CATEGORY = generateNormalizedCategory(
    '',
    null,
    CATEGORY_NAME,
    CATEGORY_EXTERNAL_ID,
    {
      id: null,
      externalId: PARENT_CATEGORY_EXTERNAL_ID,
      name: PARENT_CATEGORY_NAME,
    },
  );
  const PARENT_CATEGORY = generateNormalizedCategory(
    '',
    null,
    PARENT_CATEGORY_NAME,
    PARENT_CATEGORY_EXTERNAL_ID,
  );
  const DOCUMENT: Document = {
    ...generateRawDocument(
      '<p>article body</p>',
      {
        id: null,
        externalId: CATEGORY_EXTERNAL_ID,
        name: CATEGORY_NAME,
      },
      null,
      'article-number',
    ),
    externalIdAlternatives: ['kb_knowledge:0d7094289f011200550bf7b6077fcffc'],
  };

  let config: ServiceNowConfig;
  let adapter: ServiceNowAdapter;
  let loader: ServiceNowLoader;
  let context: ServiceNowContext;

  beforeEach(async () => {
    config = {
      servicenowUsername: 'user',
      servicenowPassword: 'password',
      servicenowBaseUrl: 'https://test-url.com',
    };
    adapter = new ServiceNowAdapter();
    loader = new ServiceNowLoader();
    context = buildContext();

    mockArticleIterator.mockImplementation(articleIterator);
    mockCategoryIterator.mockImplementation(categoryIterator);
  });

  describe('run', () => {
    beforeEach(async () => {
      await loader.initialize(
        config,
        {
          sourceAdapter: adapter,
          destinationAdapter: {} as Adapter,
        },
        context,
      );
    });

    it('should map categories', async () => {
      const { value: result1 } = await loader.categoryIterator().next();
      const { value: result2 } = await loader.categoryIterator().next();

      expect(result1).toEqual(PARENT_CATEGORY);
      expect(result2).toEqual(CATEGORY);
    });

    it('should map articles', async () => {
      const { value } = await loader.documentIterator().next();

      expect(value).toEqual(DOCUMENT);
      expect(
        context.articleLookupTable[
          'kb_knowledge:0d7094289f011200550bf7b6077fcffc'
        ],
      ).toEqual({
        externalDocumentId: 'article-number',
        externalDocumentIdAlternatives: [
          'kb_knowledge:0d7094289f011200550bf7b6077fcffc',
        ],
      });
      expect(context.articleLookupTable['article-number']).toEqual({
        externalDocumentId: 'article-number',
        externalDocumentIdAlternatives: [
          'kb_knowledge:0d7094289f011200550bf7b6077fcffc',
        ],
      });
      expect(
        context.articleLookupTable['0d7094289f011200550bf7b6077fcffc'],
      ).toEqual({
        externalDocumentId: 'article-number',
        externalDocumentIdAlternatives: [
          'kb_knowledge:0d7094289f011200550bf7b6077fcffc',
        ],
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
          context,
        );
      });

      it('should leave categories empty', async () => {
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
          context,
        );
      });

      it('should leave documents empty', async () => {
        const result = await arraysFromAsync(loader.documentIterator());

        expect(result.length).toBe(0);

        expect(Object.entries(context.articleLookupTable).length).toBe(0);
      });
    });
  });

  function buildContext(): ServiceNowContext {
    return {
      adapter: {
        unprocessedItems: {
          categories: [] as ServiceNowCategory[],
          labels: [] as unknown[],
          articles: [] as ServiceNowArticle[],
        },
      },
      syncableContents: {
        categories: {
          created: [],
          updated: [],
          deleted: [],
        },
        labels: {
          created: [],
          updated: [],
          deleted: [],
        },
        documents: {
          created: [],
          updated: [],
          deleted: [],
        },
      },
      articleLookupTable: {},
      categoryLookupTable: {
        [CATEGORY_EXTERNAL_ID]: {
          id: null,
          name: CATEGORY_NAME,
          externalId: CATEGORY_EXTERNAL_ID,
        },
      },
      labelLookupTable: {},
    };
  }
});

jest.mock('./servicenow-adapter.js', () => {
  return {
    ServiceNowAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: ServiceNowConfig) => Promise<void>>(),
        categoryIterator: () => mockCategoryIterator(),
        labelIterator: () => mockLabelIterator(),
        articleIterator: () => mockArticleIterator(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
      };
    }),
  };
});

async function* articleIterator(): AsyncGenerator<
  ServiceNowArticle,
  void,
  void
> {
  yield generateArticle();
}

function generateArticle(): ServiceNowArticle {
  return {
    link: 'article-link',
    id: 'kb_knowledge:0d7094289f011200550bf7b6077fcffc',
    title: 'article-title',
    snippet: 'article-snippet',
    number: 'article-number',
    fields: {
      kb_category: {
        name: 'kb_category',
        label: 'Category',
        value: CATEGORY_EXTERNAL_ID,
        display_value: CATEGORY_NAME,
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

async function* categoryIterator(): AsyncGenerator<
  ServiceNowCategory,
  void,
  void
> {
  yield generateCategory(
    CATEGORY_EXTERNAL_ID,
    CATEGORY_NAME,
    PARENT_CATEGORY_EXTERNAL_ID,
  );
  yield generateCategory(PARENT_CATEGORY_EXTERNAL_ID, PARENT_CATEGORY_NAME);
}

function generateCategory(
  id: string,
  name: string,
  parentId?: string,
): ServiceNowCategory {
  return {
    sys_id: id,
    full_category: name,
    ...(parentId
      ? {
          parent_id: { link: '', value: parentId },
        }
      : {}),
  };
}
