import { isString } from 'lodash';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SalesforceApi } from './salesforce-api.js';
import { fetch, Response } from '../utils/web-client.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceContext } from './model/salesforce-context.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';

jest.mock('../utils/web-client.js');

describe('SalesforceApi', () => {
  const config: SalesforceConfig = {
    salesforceLoginUrl: 'https://login-url',
    salesforceApiVersion: 'v56.0',
    salesforceClientId: 'client-id',
    salesforceClientSecret: 'client-secret',
    salesforceUsername: 'username',
    salesforcePassword: 'password',
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
          ...config,
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
          ...config,
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
          ...config,
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
  });

  function mockLoginResponse(): void {
    mockApiResponse(200, {
      access_token: 'access-token',
      instance_url: 'https://base-url',
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
    };
  }
});
