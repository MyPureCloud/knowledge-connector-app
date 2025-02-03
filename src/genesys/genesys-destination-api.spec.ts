import { GenesysDestinationApi } from './genesys-destination-api.js';
import { GenesysDestinationConfig } from './model/genesys-destination-config.js';
import { fetch, Response } from '../utils/web-client.js';
import { TokenResponse } from './model/token-response.js';
import { SearchAssetResponse } from './model/search-asset-response.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SyncDataResponse } from '../model';

jest.mock('../utils/package-version.js');
jest.mock('../utils/web-client.js');

describe('GenesysDestinationApi', () => {
  const KB_ID = 'kb-id';

  let genesysDestinationApi: GenesysDestinationApi;
  let mockFetch: jest.Mock<typeof fetch>;

  beforeEach(() => {
    genesysDestinationApi = new GenesysDestinationApi();

    mockFetch = fetch as jest.Mock<typeof fetch>;
    mockLoginResponse();
  });

  describe('createExportJob', () => {
    beforeEach(async () => {
      await genesysDestinationApi.initialize(getConfig());
    });

    it('should call export API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: 'asset-id',
              },
            ],
          } as SearchAssetResponse),
      } as Response);

      const response = await genesysDestinationApi.lookupImage({
        sortBy: 'name',
        pageSize: 100,
        query: [
          {
            value: 'hash-to-search-for',
            fields: ['name'],
            type: 'STARTS_WITH',
          },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://base-url/api/v2/responsemanagement/responseassets/search',
        {
          body: '{"sortBy":"name","pageSize":100,"query":[{"value":"hash-to-search-for","fields":["name"],"type":"STARTS_WITH"}]}',
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      );
      expect(response.results[0].id).toBe('asset-id');
    });
  });

  describe('createSyncJob', () => {
    beforeEach(async () => {
      await genesysDestinationApi.initialize({
        ...getConfig(),
        genesysSourceId: 'source-id',
      });
    });

    it('should call sync API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'sync-id',
          } as SyncDataResponse),
      } as Response);

      const response = await genesysDestinationApi.createSyncJob('upload-key');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://base-url/api/v2/knowledge/knowledgeBases/${KB_ID}/synchronize/jobs`,
        {
          body: '{"uploadKey":"upload-key","sourceId":"source-id"}',
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      );
      expect(response.id).toBe('sync-id');
    });
  });

  function mockLoginResponse() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ access_token: 'access-token' } as TokenResponse),
    } as Response);
  }

  function getConfig(): GenesysDestinationConfig {
    return {
      genesysBaseUrl: 'https://base-url',
      genesysLoginUrl: 'https://login-url',
      genesysClientId: 'client-id',
      genesysClientSecret: 'client-secret',
      genesysKnowledgeBaseId: KB_ID,
    };
  }
});
