import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceNowAdapter } from './servicenow-adapter';
import { ServiceNowContext } from './model/servicenow-context';
import { ServiceNowConfig } from './model/servicenow-config';
import { ServiceNowCategory } from './model/servicenow-category';
import { ServiceNowArticle } from './model/servicenow-article';
import { ServiceNowSingleArticle } from './model/servicenow-single-article-response';

const mockCategoryIterator =
  jest.fn<() => AsyncGenerator<ServiceNowCategory, void, void>>();
const mockLabelIterator = jest.fn<() => AsyncGenerator<unknown, void, void>>();
const mockArticleIterator =
  jest.fn<() => AsyncGenerator<ServiceNowArticle, void, void>>();
const mockGetArticle =
  jest.fn<(id: string) => Promise<ServiceNowSingleArticle | null>>();

describe('ServiceNowAdapter', () => {
  const ARTICLE_SYS_ID = 'article-sys-id';
  const ARTICLE_NUMBER = 'article-number';
  const PUBLISHED_ARTICLE_SYS_ID = 'published-article-sys-id';
  const PUBLISHED_ARTICLE: ServiceNowSingleArticle = {
    sys_id: PUBLISHED_ARTICLE_SYS_ID,
    number: ARTICLE_NUMBER,
  } as ServiceNowSingleArticle;
  const ARCHIVED_ARTICLE: ServiceNowSingleArticle = {
    sys_id: ARTICLE_SYS_ID,
    number: ARTICLE_NUMBER,
  } as ServiceNowSingleArticle;

  let config: ServiceNowConfig;
  let context: ServiceNowContext;
  let adapter: ServiceNowAdapter;

  beforeEach(async () => {
    config = {};
    context = {
      adapter: {
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      articleLookupTable: {},
      categoryLookupTable: {},
    };

    mockArticleIterator.mockImplementation(articleIterator);

    adapter = new ServiceNowAdapter();

    await adapter.initialize(config, context);
  });

  describe('constructDocumentLink', () => {
    describe('when requested article found', () => {
      beforeEach(() => {
        mockGetArticle.mockResolvedValue(ARCHIVED_ARTICLE);
        mockGetArticle.mockResolvedValue(PUBLISHED_ARTICLE);
      });

      it('should return given article', async () => {
        const actual = await adapter.constructDocumentLink(
          PUBLISHED_ARTICLE_SYS_ID,
        );

        expect(mockGetArticle).toHaveBeenCalledTimes(2);
        expect(mockGetArticle.mock.calls[0]).toEqual([
          PUBLISHED_ARTICLE_SYS_ID,
        ]);
        expect(mockGetArticle.mock.calls[1]).toEqual([ARTICLE_NUMBER]);
        expect(actual).toEqual({
          externalDocumentId: ARTICLE_NUMBER,
          externalDocumentIdAlternatives: [
            `kb_knowledge:${PUBLISHED_ARTICLE_SYS_ID}`,
          ],
        });
      });
    });

    describe('when requested article not found', () => {
      beforeEach(() => {
        mockGetArticle.mockResolvedValue(null);
      });

      it('should return null', async () => {
        const actual = await adapter.constructDocumentLink(ARTICLE_SYS_ID);

        expect(mockGetArticle).toHaveBeenCalledTimes(1);
        expect(mockGetArticle.mock.calls[0]).toEqual([ARTICLE_SYS_ID]);
        expect(actual).toEqual(null);
      });
    });
  });
});

jest.mock('./servicenow-api.js', () => {
  return {
    ServiceNowApi: jest.fn().mockImplementation(() => {
      return {
        initialize: async (
          _config: ServiceNowConfig,
          _context: ServiceNowContext,
        ) => {},
        categoryIterator: () => mockCategoryIterator(),
        labelIterator: () => mockLabelIterator(),
        articleIterator: () => mockArticleIterator(),
        getArticle: (id: string) => mockGetArticle(id),
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
        value: '',
        display_value: '',
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
