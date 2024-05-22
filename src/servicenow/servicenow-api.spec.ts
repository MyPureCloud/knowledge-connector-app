jest.mock('../utils/web-client.js');
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetch, Response } from '../utils/web-client.js';

describe('ServiceNowApi', () => {
  const baseUrl: string = 'https://test-url.com/api/sn_km_api/knowledge/articles?fields=category,text,workflow_state,topic';
  const headers = {
    headers: {
      Authorization: 'Basic dXNlcjpwYXNzd29yZA=='
    }
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
        display_value: 'Test category'
      },
      topic: {
        name: 'Test topic',
        value: '3333',
        display_value: 'Test topic'
      },
      text: {
        value: 'Article text'
      },
      workflow_state: {
        value: 'Published'
      }
    }
  };
  const response = Promise.resolve({
    result: {
      meta: {
        count: 1,
        end: 1
      },
      articles: [testArticle]
    }
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
      servicenowBaseUrl: 'https://test-url.com'
    };
  });

  describe('fetchAllArticles with status ok and one article', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response
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
        limit: '2'
      }
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
        servicenowCategoryNames: 'First category'
      }
      const expectedUrl = `${baseUrl}&limit=50&filter=category%3DFirst%20category`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with multiple specific categories', async () => {
      config = {
        ...config,
        servicenowCategoryNames: 'First category,Test category'
      }
      const expectedUrl = `${baseUrl}&limit=50&filter=category%3DFirst%20category^ORcategory%3DTest%20category`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with a specific language', async () => {
      config = {
        ...config,
        servicenowLanguage: 'de'
      }
      const expectedUrl = `${baseUrl}&limit=50&language=de`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(response).toEqual([testArticle]);
      expect(fetch).toHaveBeenCalledTimes(1);
      checkFetchUrl(expectedUrl);
    });

    it('should fetch articles with one specific knowledge base', async () => {
      config = {
        ...config,
        servicenowKnowledgeBases: 'kb-id'
      }
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
        servicenowKnowledgeBases: 'kb-id1,kb-id2'
      }
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
        servicenowCategoryNames: 'First category, Test category'
      }
      const expectedUrl = `${baseUrl}&limit=2&kb=kb-id1%2Ckb-id2&filter=category%3DFirst%20category^ORcategory%3D%20Test%20category&language=de`;

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
            end: 2
          },
          articles: [testArticle, testArticle]
        }
      });

      const response2 = Promise.resolve({
        result: {
          meta: {
            count: 2,
            end: 2
          },
          articles: [testArticle, testArticle]
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => response2
      } as Response);
    });

    it('should fetch all articles', async () => {
      config = {
        ...config,
        limit: '2'
      }
      const firstExpectedUrl = `${baseUrl}&limit=2`;
      const secondExpectedUrl = `${baseUrl}&limit=2&offset=2`;

      await api.initialize(config);
      const response = await api.fetchAllArticles();

      expect(fetch).toHaveBeenCalledTimes(2);
      checkFetchUrl(firstExpectedUrl);
      checkFetchUrl(secondExpectedUrl);
      expect(response.length).toEqual(4);
      expect(response).toEqual([testArticle, testArticle, testArticle, testArticle]);
    });
  });

  describe('fetchAllArticles with status error', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null)
      } as Response);
    });

    it('should throw error', async () => {
      await api.initialize(config);
      await expect(() => api.fetchAllArticles()).rejects.toThrow(
        'Api request [https://test-url.com/api/sn_km_api/knowledge/articles?fields=category,text,workflow_state,topic&limit=50] failed with status [500] and message [null]',
      );
    });
  })

  function checkFetchUrl(expectedUrl: string) {
    expect(fetch).toHaveBeenCalledWith(expectedUrl, headers);
  }
});
