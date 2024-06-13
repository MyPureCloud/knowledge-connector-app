import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SalesforceApi } from './salesforce-api.js';
import { fetch, Response } from '../utils/web-client.js';
import { SalesforceResponse } from './model/salesforce-response.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceAccessTokenResponse } from './model/salesforce-access-token-response.js';

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            articles: [],
          } as unknown as SalesforceResponse),
      } as Response);

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
  });

  function mockLoginResponse() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: 'access-token',
          instance_url: 'https://base-url',
        } as SalesforceAccessTokenResponse),
    } as Response);
  }
});
