import { isString } from 'lodash';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SalesforceApi } from './salesforce-api.js';
import { fetch, Response } from '../utils/web-client.js';
import { SalesforceConfig } from './model/salesforce-config.js';

jest.mock('../utils/web-client.js');

describe('SalesforceApi', () => {
  let api: SalesforceApi;
  let mockFetch: jest.Mock<typeof fetch>;
  const config: SalesforceConfig = {
    salesforceLoginUrl: 'https://login-url',
    salesforceApiVersion: 'v56.0',
    salesforceClientId: 'client-id',
    salesforceClientSecret: 'client-secret',
    salesforceUsername: 'username',
    salesforcePassword: 'password',
  };

  beforeEach(() => {
    api = new SalesforceApi();

    mockFetch = fetch as jest.Mock<typeof fetch>;
    mockLoginResponse();
  });

  describe('fetchAllArticles', () => {
    it('should load articles with given filters', async () => {
      await api.initialize({
        ...config,
        salesforceChannel: 'Pkb',
        salesforceLanguageCode: 'de',
        salesforceCategories:
          '{"something":"someone","otherGroup":"other_category"}',
      });

      mockApiResponse(200, {
        articles: [],
      });

      await api.fetchAllArticles();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone","otherGroup":"other_category"}',
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Accept-Language': 'de',
          },
        },
      );
    });

    it('should load articles with transformed language code in the header', async () => {
      await api.initialize({
        ...config,
        salesforceChannel: 'Pkb',
        salesforceLanguageCode: 'de-DE',
        salesforceCategories: '{"something":"someone"}',
      });

      mockApiResponse(200, {
        articles: [],
      });

      await api.fetchAllArticles();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone"}',
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Accept-Language': 'de',
          },
        },
      );
    });

    it('should load articles with five-character language code in the header', async () => {
      await api.initialize({
        ...config,
        salesforceChannel: 'Pkb',
        salesforceLanguageCode: 'de-AT',
        salesforceCategories: '{"something":"someone"}',
      });

      mockApiResponse(200, {
        articles: [],
      });

      await api.fetchAllArticles();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/services/data/v56.0/support/knowledgeArticles?channel=Pkb&categories={"something":"someone"}',
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
});
