import { isString } from 'lodash';
import { ApiError } from '../adapter/errors/api-error.js';
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetch, Response } from '../utils/web-client.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowCategoryResponse } from './model/servicenow-category-response.js';
import { ServiceNowSingleArticleResponse } from './model/servicenow-single-article-response.js';

jest.mock('../utils/package-version.js');
jest.mock('../utils/web-client.js');

describe('ServiceNowApi', () => {
  const CATEGORY_ID_1 = '324989582398764';
  const CATEGORY_ID_2 = '56873484398434';
  const ARTICLE_SYS_ID = '11122233344434341246536356';
  const ARTICLE_NUMBER = 'KB111';

  const fetchArticleUrl: string =
    'https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category,sys_updated_on';
  const fetchCategoryUrl: string =
    'https://test-url.com/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined';
  const filters = '&filter=workflow_state%3Dpublished';
  const headers = {
    headers: {
      Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
    },
  };

  let mockFetch: jest.Mock<typeof fetch>;
  let api: ServiceNowApi;
  let config: ServiceNowConfig;
  let context: ServiceNowContext;

  beforeEach(async () => {
    mockFetch = fetch as jest.Mock<typeof fetch>;
    api = new ServiceNowApi();
    config = {
      servicenowUsername: 'user',
      servicenowPassword: 'password',
      servicenowBaseUrl: 'https://test-url.com',
    };
    context = buildContext();
  });

  describe('categoryIterator', () => {
    const category = generateCategory();
    const response: ServiceNowCategoryResponse = {
      result: [category],
    };

    describe('with status ok', () => {
      beforeEach(() => {
        mockApiResponse(200, response);
        mockApiResponse(200, { result: [] });
      });

      it('should fetch categories with limit 50 by default', async () => {
        const expectedUrl = `${fetchCategoryUrl}&sysparm_limit=50`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.categoryIterator());

        expect(response).toEqual([category]);
        expect(fetch).toHaveBeenCalledTimes(2);
        checkFetchUrl(expectedUrl + '&sysparm_offset=0');
        checkFetchUrl(expectedUrl + '&sysparm_offset=1');
      });
    });
  });

  describe('articleIterator', () => {
    const testArticle: ServiceNowArticle = {
      link: 'test-link',
      id: 'kb_knowledge:' + ARTICLE_SYS_ID,
      number: ARTICLE_NUMBER,
      title: 'Test title',
      snippet: 'snippet',
      fields: {
        category: {
          name: 'Test category',
          value: '2222',
          display_value: 'Test category',
        },
        topic: {
          name: 'Test topic',
          value: '3333',
          display_value: 'Test topic',
        },
        text: {
          value: 'Article text',
        },
        workflow_state: {
          value: 'Published',
        },
        sys_updated_on: {
          display_value: '04/10/2024 13:33:40',
          name: 'sys_updated_on',
          label: 'Updated',
          type: 'glide_date_time',
          value: '2024-04-10 18:33:40'
        },
      },
    };
    const response = {
      result: {
        meta: {
          count: 1,
          end: 1,
        },
        articles: [testArticle],
      },
    };

    describe('with status ok and one article', () => {
      beforeEach(() => {
        mockApiResponse(200, response);
      });

      it('should fetch articles with limit 50 by default', async () => {
        const expectedUrl = `${fetchArticleUrl}${filters}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with custom limit', async () => {
        config = {
          ...config,
          limit: '2',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}&limit=2&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with one specific category', async () => {
        config = {
          ...config,
          servicenowCategories: CATEGORY_ID_1,
        };
        const expectedUrl = `${fetchArticleUrl}${filters}%5Ekb_category%3D${CATEGORY_ID_1}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with multiple specific categories', async () => {
        config = {
          ...config,
          servicenowCategories: `${CATEGORY_ID_1}   ,   ${CATEGORY_ID_2}  `,
        };
        const expectedUrl = `${fetchArticleUrl}${filters}%5Ekb_category%3D${CATEGORY_ID_1}%5EORkb_category%3D${CATEGORY_ID_2}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with a specific two-letter language code', async () => {
        config = {
          ...config,
          servicenowLanguage: 'de',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}&language=de&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with a transformed five-character language code', async () => {
        config = {
          ...config,
          servicenowLanguage: 'en-US',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}&language=en&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with one specific knowledge base', async () => {
        config = {
          ...config,
          servicenowKnowledgeBases: 'kb-id',
        };
        const expectedUrl = `${fetchArticleUrl}&kb=${config.servicenowKnowledgeBases}${filters}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with multiple knowledge bases', async () => {
        config = {
          ...config,
          servicenowKnowledgeBases: 'kb-id1,kb-id2',
        };
        const expectedUrl = `${fetchArticleUrl}&kb=kb-id1%2Ckb-id2${filters}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });

      it('should fetch articles with custom settings', async () => {
        config = {
          ...config,
          limit: '2',
          servicenowKnowledgeBases: 'kb-id1,kb-id2',
          servicenowLanguage: 'de',
          servicenowCategories: `${CATEGORY_ID_2},${CATEGORY_ID_1}`,
        };
        const expectedUrl = `${fetchArticleUrl}&kb=kb-id1%2Ckb-id2${filters}%5Ekb_category%3D${CATEGORY_ID_2}%5EORkb_category%3D${CATEGORY_ID_1}&language=de&limit=2&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl);
      });
    });

    describe('with status ok and pagination', () => {
      beforeEach(() => {
        const response = {
          result: {
            meta: {
              count: 4,
              end: 2,
            },
            articles: [testArticle, testArticle],
          },
        };

        const response2 = {
          result: {
            meta: {
              count: 2,
              end: 2,
            },
            articles: [testArticle, testArticle],
          },
        };

        mockApiResponse(200, response);
        mockApiResponse(200, response2);
      });

      it('should fetch all articles', async () => {
        config = {
          ...config,
          limit: '2',
        };
        const firstExpectedUrl = `${fetchArticleUrl}${filters}&limit=2&offset=0`;
        const secondExpectedUrl = `${fetchArticleUrl}${filters}&limit=2&offset=2`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(fetch).toHaveBeenCalledTimes(2);
        checkFetchUrl(firstExpectedUrl);
        checkFetchUrl(secondExpectedUrl);
        expect(response.length).toEqual(4);
        expect(response).toEqual([
          testArticle,
          testArticle,
          testArticle,
          testArticle,
        ]);
      });
    });

    describe('with status error', () => {
      const ERROR_BODY = '<some><xml></xml></some>';

      beforeEach(() => {
        mockApiResponse(500, ERROR_BODY);
      });

      it('should throw api error', async () => {
        await api.initialize(config, context);
        await expect(() =>
          arraysFromAsync(api.articleIterator()),
        ).rejects.toThrowError(
          new ApiError(
            `Api request [https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category,sys_updated_on${filters}&limit=50&offset=0] failed with status [500] and message [${ERROR_BODY}]`,
            {
              url: 'https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&limit=50',
              status: 500,
            },
          ),
        );
      });
    });
  });

  describe('getArticle', () => {
    describe('with status ok', () => {
      beforeEach(async () => {
        mockApiResponse(200, {
          result: {
            sys_id: ARTICLE_SYS_ID,
            number: ARTICLE_NUMBER,
          },
        } as ServiceNowSingleArticleResponse);

        await api.initialize(config, context);
      });

      it('should fetch article', async () => {
        const expectedUrl1 = `https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_SYS_ID}`;

        const actual = await api.getArticle(ARTICLE_SYS_ID);

        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl1);
        expect(actual).toEqual({
          sys_id: ARTICLE_SYS_ID,
          number: ARTICLE_NUMBER,
        });
      });
    });

    describe('with status error', () => {
      const ERROR_BODY = '<some><xml></xml></some>';

      beforeEach(() => {
        mockApiResponse(500, ERROR_BODY);
      });

      it('should return null', async () => {
        const actual = await api.getArticle(ARTICLE_NUMBER);

        expect(actual).toEqual(null);
      });
    });
  });

  function checkFetchUrl(expectedUrl: string) {
    expect(fetch).toHaveBeenCalledWith(expectedUrl, headers);
  }

  function mockApiResponse(status: number, body: unknown): void {
    const str = isString(body) ? body : JSON.stringify(body);

    mockFetch.mockResolvedValueOnce({
      ok: status === 200,
      status,
      text: () => Promise.resolve(str),
    } as Response);
  }

  function buildContext(): ServiceNowContext {
    return {
      adapter: {
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      articleLookupTable: {},
      categoryLookupTable: {},
      labelLookupTable: {},
    };
  }

  function generateCategory(): ServiceNowCategory {
    return {
      sys_id: 'sys-id',
      full_category: 'full-category',
    };
  }
});
