import { ApiError } from '../adapter/errors/ApiError.js';

jest.mock('../utils/web-client.js');
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetch, Response } from '../utils/web-client.js';
import { ErrorCodes } from '../utils/errors/ErrorCodes.js';

describe('ServiceNowApi', () => {
  const CATEGORY_ID_1 = '324989582398764';
  const CATEGORY_ID_2 = '56873484398434';

  const baseUrl: string =
    'https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category';
  const headers = {
    headers: {
      Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
    },
  };
  const testArticle: ServiceNowArticle = {
    link: 'test-link',
    id: '111',
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
    },
  };
  const response = Promise.resolve({
    result: {
      meta: {
        count: 1,
        end: 1,
      },
      articles: [testArticle],
    },
  });
  let mockFetch: jest.Mock<typeof fetch>;
  let api: ServiceNowApi;
  let config: ServiceNowConfig;

  beforeEach(async () => {
    mockFetch = fetch as jest.Mock<typeof fetch>;
    api = new ServiceNowApi();
    config = {
      servicenowUsername: 'user',
      servicenowPassword: 'password',
      servicenowBaseUrl: 'https://test-url.com',
    };
  });

  describe('fetchAllArticles with status ok and one article', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response,
      } as Response);
    });

    it('should fetch articles with limit 50 by default', async () => {
      const expectedUrl = `${baseUrl}&limit=50`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with custom limit', async () => {
      config = {
        ...config,
        limit: '2',
      };
      const expectedUrl = `${baseUrl}&limit=2`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with one specific category', async () => {
      config = {
        ...config,
        servicenowCategories: CATEGORY_ID_1,
      };
      const expectedUrl = `${baseUrl}&limit=50&filter=kb_category%3D${CATEGORY_ID_1}`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with multiple specific categories', async () => {
      config = {
        ...config,
        servicenowCategories: `${CATEGORY_ID_1}   ,   ${CATEGORY_ID_2}  `,
      };
      const expectedUrl = `${baseUrl}&limit=50&filter=kb_category%3D${CATEGORY_ID_1}%5EORkb_category%3D${CATEGORY_ID_2}`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with a specific two-letter language code', async () => {
      config = {
        ...config,
        servicenowLanguage: 'de',
      };
      const expectedUrl = `${baseUrl}&limit=50&language=de`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with a transformed five-character language code', async () => {
      config = {
        ...config,
        servicenowLanguage: 'en-US',
      };
      const expectedUrl = `${baseUrl}&limit=50&language=en`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with one specific knowledge base', async () => {
      config = {
        ...config,
        servicenowKnowledgeBases: 'kb-id',
      };
      const expectedUrl = `${baseUrl}&limit=50&kb=${config.servicenowKnowledgeBases}`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with multiple knowledge bases', async () => {
      config = {
        ...config,
        servicenowKnowledgeBases: 'kb-id1,kb-id2',
      };
      const expectedUrl = `${baseUrl}&limit=50&kb=kb-id1%2Ckb-id2`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

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
      const expectedUrl = `${baseUrl}&limit=2&kb=kb-id1%2Ckb-id2&filter=kb_category%3D${CATEGORY_ID_2}%5EORkb_category%3D${CATEGORY_ID_1}&language=de`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });
  });

  describe('fetchAllArticles with status ok and pagination', () => {
    beforeEach(() => {
      const response = Promise.resolve({
        result: {
          meta: {
            count: 4,
            end: 2,
          },
          articles: [testArticle, testArticle],
        },
      });

      const response2 = Promise.resolve({
        result: {
          meta: {
            count: 2,
            end: 2,
          },
          articles: [testArticle, testArticle],
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response2,
      } as Response);
    });

    it('should fetch all articles', async () => {
      config = {
        ...config,
        limit: '2',
      };
      const firstExpectedUrl = `${baseUrl}&limit=2`;
      const secondExpectedUrl = `${baseUrl}&limit=2&offset=2`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

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

  describe('fetchAllArticles with status error', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
      } as Response);
    });

    it('should throw api error', async () => {
      await api.initialize(config);
      await expect(() => api.fetchAllArticles()).rejects.toThrowError(
        new ApiError(
          ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR,
          'Api request [https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&limit=50] failed with status [500] and message [null]',
        ),
      );
    });
  });

  function checkFetchUrl(expectedUrl: string) {
    expect(fetch).toHaveBeenCalledWith(expectedUrl, headers);
  }
});
