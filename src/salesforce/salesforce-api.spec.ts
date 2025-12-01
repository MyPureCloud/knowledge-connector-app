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
import { EntityType } from '../model/entity-type.js';
import { URLSearchParams } from 'url';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';

jest.mock('../utils/package-version.js');
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
    salesforceChannel: 'Pkb',
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
        EntityType.DOCUMENT,
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
        EntityType.DOCUMENT,
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
        EntityType.DOCUMENT,
      );
    });

    it('should load all articles', async () => {
      await api.initialize(CONFIG, context);
      const verifyPkbChannelFetch = mockPkbChannelArticleResponse();

      const response = await arraysFromAsync(api.articleIterator());

      expect(fetch).toHaveBeenCalledTimes(3); // 1 login + 1 page + 1 article detail
      verifyPkbChannelFetch();
      expect(response.length).toEqual(1);
      expect(response).toEqual([constructArticle('4')]);
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

    describe('filter multiple channels', () => {
      it('should load all articles from given channels', async () => {
        await api.initialize(
          { ...CONFIG, salesforceChannel: 'App,Pkb,  ,  Prm' },
          context,
        );

        const verifyAppChannelFetch = mockAppChannelArticleResponse();
        const verifyPkbChannelFetch = mockPkbChannelArticleResponse();
        const verifyPrmChannelFetch = mockPrmChannelArticleResponse();

        const response = await arraysFromAsync(api.articleIterator());

        expect(fetch).toHaveBeenCalledTimes(13); // 1 login + 5 page + 7 article detail
        verifyAppChannelFetch();
        verifyPkbChannelFetch();
        verifyPrmChannelFetch();

        expect(response.length).toEqual(7);
        expect(response).toEqual([
          constructArticle('1'),
          constructArticle('2'),
          constructArticle('3'),
          constructArticle('4'),
          constructArticle('6'),
          constructArticle('7'),
          constructArticle('8'),
        ]);
      });
    });

    describe('when no channel filter defined', () => {
      it('should load all articles from all channels', async () => {
        await api.initialize(
          { ...CONFIG, salesforceChannel: undefined },
          context,
        );

        const verifyAppChannelFetch = mockAppChannelArticleResponse();
        const verifyPkbChannelFetch = mockPkbChannelArticleResponse();
        const verifyCspChannelFetch = mockCspChannelArticleResponse();
        const verifyPrmChannelFetch = mockPrmChannelArticleResponse();

        const response = await arraysFromAsync(api.articleIterator());

        expect(fetch).toHaveBeenCalledTimes(15); // 1 login + 6 page + 8 article detail
        verifyAppChannelFetch();
        verifyPkbChannelFetch();
        verifyCspChannelFetch();
        verifyPrmChannelFetch();

        expect(response.length).toEqual(8);
        expect(response).toEqual([
          constructArticle('1'),
          constructArticle('2'),
          constructArticle('3'),
          constructArticle('4'),
          constructArticle('5'),
          constructArticle('6'),
          constructArticle('7'),
          constructArticle('8'),
        ]);
      });
    });

    describe('when interrupted', () => {
      describe('between channels', () => {
        it('should continue from the state', async () => {
          await api.initialize(
            { ...CONFIG, salesforceChannel: 'App,Pkb' },
            context,
          );

          const verifyAppChannelFetch = mockAppChannelArticleResponse();
          // Interrupt after App channel
          mockFetch.mockRejectedValueOnce(new Interrupted());
          const verifyPkbChannelFetch = mockPkbChannelArticleResponse();

          const beforeInterrupted: SalesforceArticleDetails[] = [];
          await expect(async () => {
            for await (const item of api.articleIterator()) {
              beforeInterrupted.push(item);
            }
          }).rejects.toThrow(Interrupted);

          // start again
          const afterInterrupted = await arraysFromAsync(api.articleIterator());

          expect(fetch).toHaveBeenCalledTimes(9); // 1 login + 3 page + 4 article detail + 1 interrupted
          verifyAppChannelFetch();
          verifyPkbChannelFetch();
          expect(beforeInterrupted.length).toEqual(3);
          expect(beforeInterrupted).toEqual([
            constructArticle('1'),
            constructArticle('2'),
            constructArticle('3'),
          ]);
          expect(afterInterrupted.length).toEqual(1);
          expect(afterInterrupted).toEqual([constructArticle('4')]);
        });
      });

      describe('middle of a channel', () => {
        it('should continue from the state', async () => {
          await api.initialize(
            { ...CONFIG, salesforceChannel: 'App,Pkb' },
            context,
          );

          const verifyAppChannelFetch = mockAppChannelArticleResponse(true);
          const verifyPkbChannelFetch = mockPkbChannelArticleResponse();

          const beforeInterrupted: SalesforceArticleDetails[] = [];
          await expect(async () => {
            for await (const item of api.articleIterator()) {
              beforeInterrupted.push(item);
            }
          }).rejects.toThrow(Interrupted);

          // start again
          const afterInterrupted = await arraysFromAsync(api.articleIterator());

          expect(fetch).toHaveBeenCalledTimes(9); // 1 login + 3 page + 4 article detail + 1 interrupted
          verifyAppChannelFetch();
          verifyPkbChannelFetch();
          expect(beforeInterrupted.length).toEqual(1);
          expect(beforeInterrupted).toEqual([constructArticle('1')]);
          expect(afterInterrupted.length).toEqual(3);
          expect(afterInterrupted).toEqual([
            constructArticle('2'),
            constructArticle('3'),
            constructArticle('4'),
          ]);
        });
      });
    });
  });

  describe('initialize', () => {
    it('should authenticate with password grant type', async () => {
      const expectedParams = new URLSearchParams();
      expectedParams.append('grant_type', 'password');
      expectedParams.append('client_id', 'client-id');
      expectedParams.append('client_secret', 'client-secret');
      expectedParams.append('username', 'username');
      expectedParams.append('password', 'password');

      await api.initialize(CONFIG, context);

      expect(fetch).toHaveBeenCalledWith(
        'https://login-url/services/oauth2/token',
        {
          method: 'POST',
          body: expectedParams,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
        undefined,
      );
    });

    it('should authenticate with Client Credentials grant type', async () => {
      const expectedParams = new URLSearchParams();
      expectedParams.append('grant_type', 'client_credentials');
      expectedParams.append('client_id', 'client-id');
      expectedParams.append('client_secret', 'client-secret');

      await api.initialize(
        {
          ...CONFIG,
          salesforceOauthGrantType: 'client_credentials',
        },
        context,
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://login-url/services/oauth2/token',
        {
          method: 'POST',
          body: expectedParams,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
        undefined,
      );
    });
  });

  function mockLoginResponse(): void {
    mockApiResponse(200, {
      access_token: ACCESS_TOKEN,
      instance_url: BASE_URL,
    });
  }

  function mockAppChannelArticleResponse(
    withInterruption: boolean = false,
  ): () => void {
    const firstExpectedUrl = `${BASE_URL}/services/data/${CONFIG.salesforceApiVersion}/support/knowledgeArticles?channel=App`;
    const secondExpectedUrl = `${BASE_URL}/app-the-next-page`;

    mockApiResponse(200, {
      articles: [constructArticle('1'), constructArticle('2')],
      nextPageUrl: '/app-the-next-page',
    });
    mockApiResponse(200, constructArticle('1'));
    if (withInterruption) {
      mockFetch.mockRejectedValueOnce(new Interrupted());
    }
    mockApiResponse(200, constructArticle('2'));
    mockApiResponse(200, {
      articles: [constructArticle('3')],
      nextPageUrl: null,
    });
    mockApiResponse(200, constructArticle('3'));

    return () => {
      checkFetchUrl(firstExpectedUrl);
      checkFetchUrl(secondExpectedUrl);
    };
  }

  function mockPkbChannelArticleResponse() {
    const firstExpectedUrl = `${BASE_URL}/services/data/${CONFIG.salesforceApiVersion}/support/knowledgeArticles?channel=Pkb`;

    mockApiResponse(200, {
      articles: [constructArticle('4')],
      nextPageUrl: null,
    });
    mockApiResponse(200, constructArticle('4'));

    return () => {
      checkFetchUrl(firstExpectedUrl);
    };
  }

  function mockPrmChannelArticleResponse() {
    const firstExpectedUrl = `${BASE_URL}/services/data/${CONFIG.salesforceApiVersion}/support/knowledgeArticles?channel=Prm`;
    const secondExpectedUrl = `${BASE_URL}/prm-the-next-page`;

    mockApiResponse(200, {
      articles: [constructArticle('6'), constructArticle('7')],
      nextPageUrl: '/prm-the-next-page',
    });
    mockApiResponse(200, constructArticle('6'));
    mockApiResponse(200, constructArticle('7'));
    mockApiResponse(200, {
      articles: [constructArticle('8')],
      nextPageUrl: null,
    });
    mockApiResponse(200, constructArticle('8'));

    return () => {
      checkFetchUrl(firstExpectedUrl);
      checkFetchUrl(secondExpectedUrl);
    };
  }

  function mockCspChannelArticleResponse() {
    const firstExpectedUrl = `${BASE_URL}/services/data/${CONFIG.salesforceApiVersion}/support/knowledgeArticles?channel=Csp`;

    mockApiResponse(200, {
      articles: [constructArticle('5')],
      nextPageUrl: null,
    });
    mockApiResponse(200, constructArticle('5'));

    return () => {
      checkFetchUrl(firstExpectedUrl);
    };
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
    expect(fetch).toHaveBeenCalledWith(
      expectedUrl,
      { headers: HEADERS },
      EntityType.DOCUMENT,
    );
  }

  function buildContext(): SalesforceContext {
    return {
      api: {
        [SalesforceEntityTypes.ARTICLES]: {
          done: false,
          started: false,
          nextUrl: null,
          channels: null,
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
