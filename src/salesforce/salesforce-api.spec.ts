import { isString } from 'lodash';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SalesforceApi } from './salesforce-api.js';
import { fetch, Response } from '../utils/web-client.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceContext } from './model/salesforce-context.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { Interrupted } from '../utils/errors/interrupted.js';

jest.mock('../utils/web-client.js');

describe('SalesforceApi', () => {
  const ACCESS_TOKEN = 'access-token';
  const BASE_URL = 'https://base-url';
  const CONFIG: SalesforceConfig = {
    salesforceLoginUrl: 'https://login-url',
    salesforceApiVersion: 'v56.0',
    salesforceClientId: 'client-id',
    salesforceClientSecret: 'client-secret',
    salesforceUsername: 'username',
    salesforcePassword: 'password',
    salesforceLanguageCode: 'en-US',
  };
  const HEADERS = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Accept-Language': 'en-US',
  };
  let api: SalesforceApi;
  let mockFetch: jest.Mock<typeof fetch>;
  let context: SalesforceContext;

  beforeEach(() => {
    api = new SalesforceApi();
    context = buildContext();

    mockFetch = fetch as jest.Mock<typeof fetch>;
    mockLoginResponse();
  });

  describe('articleIterator', () => {
    it('should load articles with given filters', async () => {
      await api.initialize(
        {
          ...CONFIG,
          salesforceChannel: 'Pkb',
          salesforceLanguageCode: 'de',
          salesforceCategories:
            '{"something":"someone","otherGroup":"other_category"}',
        },
        context,
      );

      mockApiResponse(200, {
        articles: [],
      });

      await api.articleIterator().next();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone","otherGroup":"other_category"}&queryMethod=BELOW',
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Accept-Language': 'de',
          },
        },
      );
    });

    it('should load articles with transformed language code in the header', async () => {
      await api.initialize(
        {
          ...CONFIG,
          salesforceChannel: 'Pkb',
          salesforceLanguageCode: 'de-DE',
          salesforceCategories: '{"something":"someone"}',
        },
        context,
      );

      mockApiResponse(200, {
        articles: [],
      });

      await api.articleIterator().next();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone"}&queryMethod=BELOW',
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Accept-Language': 'de',
          },
        },
      );
    });

    it('should load articles with five-character language code in the header', async () => {
      await api.initialize(
        {
          ...CONFIG,
          salesforceChannel: 'Pkb',
          salesforceLanguageCode: 'de-AT',
          salesforceCategories: '{"something":"someone"}',
        },
        context,
      );

      mockApiResponse(200, {
        articles: [],
      });

      await api.articleIterator().next();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone"}&queryMethod=BELOW',
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Accept-Language': 'de-AT',
          },
        },
      );
    });

    it('should load all articles', async () => {
      const firstExpectedUrl = `${BASE_URL}/services/data/${CONFIG.salesforceApiVersion}/support/knowledgeArticles?`;
      const secondExpectedUrl = `${BASE_URL}/the-next-page`;

      await api.initialize(CONFIG, context);

      mockApiResponse(200, {
        articles: [constructArticle('1'), constructArticle('2')],
        nextPageUrl: '/the-next-page',
      });
      mockApiResponse(200, constructArticle('1'));
      mockApiResponse(200, constructArticle('2'));
      mockApiResponse(200, {
        articles: [constructArticle('3')],
        nextPageUrl: null,
      });
      mockApiResponse(200, constructArticle('3'));

      const response = await arraysFromAsync(api.articleIterator());

      expect(fetch).toHaveBeenCalledTimes(6); // 1 login + 2 page + 3 article detail
      checkFetchUrl(firstExpectedUrl);
      checkFetchUrl(secondExpectedUrl);
      expect(response.length).toEqual(3);
      expect(response).toEqual([
        constructArticle('1'),
        constructArticle('2'),
        constructArticle('3'),
      ]);
    });

    it('should not lost any article when interrupted', async () => {
      expect.assertions(4);

      const article1 = constructArticle('1');
      const article2 = constructArticle('2');

      await api.initialize(CONFIG, context);

      mockApiResponse(200, {
        articles: [article1, article2],
        nextPageUrl: null,
      });
      mockApiResponse(200, article1);
      mockFetch.mockImplementation(() => {
        throw new Interrupted();
      });

      await expect(async () => {
        for await (const item of api.articleIterator()) {
          expect(item).toEqual(article1);
        }
      }).rejects.toThrow(Interrupted);

      expect(fetch).toHaveBeenCalledTimes(4); // 1 login + 1 page + 2 article detail
      expect(
        context.api![SalesforceEntityTypes.ARTICLES].unprocessed,
      ).toHaveLength(1);
    });
  });

  function mockLoginResponse(): void {
    mockApiResponse(200, {
      access_token: ACCESS_TOKEN,
      instance_url: BASE_URL,
    });
  }

  function mockApiResponse(status: number, body: unknown): void {
    const str = isString(body) ? body : JSON.stringify(body);

    mockFetch.mockResolvedValueOnce({
      ok: status === 200,
      status,
      text: () => Promise.resolve(str),
    } as Response);
  }

  function checkFetchUrl(expectedUrl: string) {
    expect(fetch).toHaveBeenCalledWith(expectedUrl, { headers: HEADERS });
  }

  function buildContext(): SalesforceContext {
    return {
      api: {
        [SalesforceEntityTypes.ARTICLES]: {
          done: false,
          started: false,
          nextUrl: null,
          unprocessed: [],
        },
        [SalesforceEntityTypes.CATEGORY_GROUPS]: {
          done: false,
          started: false,
          nextUrl: null,
          unprocessed: [],
        },
      },
      adapter: {
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      labelLookupTable: {},
      articleLookupTable: {},
      categoryLookupTable: {},
    };
  }

  function constructArticle(id: string): SalesforceArticle {
    return {
      id,
    } as SalesforceArticle;
  }
});
