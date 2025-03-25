import { isString } from 'lodash';
import { ApiError } from '../adapter/errors/api-error.js';
import { ServiceNowApi } from './servicenow-api.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import { AuthenticationType, ServiceNowConfig } from './model/servicenow-config.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetch, Response } from '../utils/web-client.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowCategoryResponse } from './model/servicenow-category-response.js';
import { ServiceNowSingleArticleResponse } from './model/servicenow-single-article-response.js';
import { EntityType } from '../model/entity-type.js';
import { ServiceNowAccessTokenResponse } from './model/servicenow-access-token-response.js';
import { URLSearchParams } from 'url';
import { ErrorCodes } from '../utils/errors/error-codes.js';
import { ValidationError } from '../utils/errors/validation-error.js';
import { InvalidCredentialsError } from '../adapter/errors/invalid-credentials-error.js';

jest.mock('../utils/package-version.js');
jest.mock('../utils/web-client.js');

describe('ServiceNowApi', () => {
  const CATEGORY_ID_1 = '324989582398764';
  const CATEGORY_ID_2 = '56873484398434';
  const ARTICLE_SYS_ID = '11122233344434341246536356';
  const ARTICLE_NUMBER = 'KB111';
  const ACCESS_TOKEN = 'test-token';
  const NEW_ACCESS_TOKEN = 'new-test-token';
  const REFRESH_TOKEN = 'refresh-token';
  const TEN_DAYS_IN_SEC = 864000;

  const fetchArticleUrl: string =
    'https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category,sys_updated_on';
  const fetchCategoryUrl: string =
    'https://test-url.com/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined';
  const filters = '&filter=workflow_state%3Dpublished';
  const order = '%5EORDERBYnumber';
  const basicAuthenticationHeaders = {
    headers: {
      Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
    },
  };
  const oAuthAuthenticationHeaders = {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    }
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
        checkFetchUrl(expectedUrl + '&sysparm_offset=0', EntityType.CATEGORY);
        checkFetchUrl(expectedUrl + '&sysparm_offset=1', EntityType.CATEGORY);
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
          value: '2024-04-10 18:33:40',
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
        const expectedUrl = `${fetchArticleUrl}${filters}${order}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with custom limit', async () => {
        config = {
          ...config,
          limit: '2',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}${order}&limit=2&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with one specific category', async () => {
        config = {
          ...config,
          servicenowCategories: CATEGORY_ID_1,
        };
        const expectedUrl = `${fetchArticleUrl}${filters}%5Ekb_category%3D${CATEGORY_ID_1}${order}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with multiple specific categories', async () => {
        config = {
          ...config,
          servicenowCategories: `${CATEGORY_ID_1}   ,   ${CATEGORY_ID_2}  `,
        };
        const expectedUrl = `${fetchArticleUrl}${filters}%5Ekb_category%3D${CATEGORY_ID_1}%5EORkb_category%3D${CATEGORY_ID_2}${order}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with a specific two-letter language code', async () => {
        config = {
          ...config,
          servicenowLanguage: 'de',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}${order}&language=de&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with a transformed five-character language code', async () => {
        config = {
          ...config,
          servicenowLanguage: 'en-US',
        };
        const expectedUrl = `${fetchArticleUrl}${filters}${order}&language=en&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with one specific knowledge base', async () => {
        config = {
          ...config,
          servicenowKnowledgeBases: 'kb-id',
        };
        const expectedUrl = `${fetchArticleUrl}&kb=${config.servicenowKnowledgeBases}${filters}${order}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with multiple knowledge bases', async () => {
        config = {
          ...config,
          servicenowKnowledgeBases: 'kb-id1,kb-id2',
        };
        const expectedUrl = `${fetchArticleUrl}&kb=kb-id1%2Ckb-id2${filters}${order}&limit=50&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
      });

      it('should fetch articles with custom settings', async () => {
        config = {
          ...config,
          limit: '2',
          servicenowKnowledgeBases: 'kb-id1,kb-id2',
          servicenowLanguage: 'de',
          servicenowCategories: `${CATEGORY_ID_2},${CATEGORY_ID_1}`,
        };
        const expectedUrl = `${fetchArticleUrl}&kb=kb-id1%2Ckb-id2${filters}%5Ekb_category%3D${CATEGORY_ID_2}%5EORkb_category%3D${CATEGORY_ID_1}${order}&language=de&limit=2&offset=0`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(response).toEqual([testArticle]);
        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl, EntityType.DOCUMENT);
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
        const firstExpectedUrl = `${fetchArticleUrl}${filters}${order}&limit=2&offset=0`;
        const secondExpectedUrl = `${fetchArticleUrl}${filters}${order}&limit=2&offset=2`;

        await api.initialize(config, context);
        const response = await arraysFromAsync(api.articleIterator());

        expect(fetch).toHaveBeenCalledTimes(2);
        checkFetchUrl(firstExpectedUrl, EntityType.DOCUMENT);
        checkFetchUrl(secondExpectedUrl, EntityType.DOCUMENT);
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
            `Api request [https://test-url.com/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category,sys_updated_on${filters}${order}&limit=50&offset=0] failed with status [500] and message [${ERROR_BODY}]`,
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
        const expectedUrl1 = `https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_SYS_ID}?fields=topic,category,kb_category,kb_knowledge_base,workflow_state,active,sys_updated_on,valid_to`;

        const actual = await api.getArticle(ARTICLE_SYS_ID);

        expect(fetch).toHaveBeenCalledTimes(1);
        checkFetchUrl(expectedUrl1, EntityType.DOCUMENT);
        expect(actual).toEqual({
          sys_id: ARTICLE_SYS_ID,
          number: ARTICLE_NUMBER,
        });
      });
    });

    describe('with status error', () => {
      const ERROR_BODY = '<some><xml></xml></some>';

      beforeEach(async () => {
        await api.initialize(config, context);

        mockApiResponse(500, ERROR_BODY);
      });

      it('should return ApiError', async () => {
        await expect(() => api.getArticle(ARTICLE_NUMBER)).rejects.toThrowError(
          new ApiError(
            `Api request [https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_NUMBER}?fields=topic,category,kb_category,kb_knowledge_base,workflow_state,active,sys_updated_on,valid_to] failed with status [500] and message [${ERROR_BODY}]`,
            {
              url: `https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_NUMBER}`,
              status: 500,
            },
          ),
        );
      });
    });
  });

  describe('OAuth', () => {
    describe('getArticle with status ok', () => {
      beforeEach(() => {
        config = {
          ...config,
          servicenowClientId: 'test-client-id',
          servicenowClientSecret: 'test-client-secret',
          servicenowAuthenticationType: AuthenticationType.OAUTH,
        };
      });

      it('should fetch article', async () => {
        mockApiResponse(200, {
          access_token: ACCESS_TOKEN,
          expires_in: TEN_DAYS_IN_SEC,
          refresh_token: REFRESH_TOKEN
        } as ServiceNowAccessTokenResponse);

        mockApiResponse(200, {
          result: {
            sys_id: ARTICLE_SYS_ID,
            number: ARTICLE_NUMBER,
          },
        } as ServiceNowSingleArticleResponse);

        await api.initialize(config, context);
        const actual = await api.getArticle(ARTICLE_SYS_ID);

        const expectedUrl1 = 'https://test-url.com/oauth_token.do';
        const expectedUrl2 = `https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_SYS_ID}`;

        expect(fetch).toHaveBeenCalledTimes(2);

        const firstCall = mockFetch.mock.calls[0];
        expect(firstCall[0]).toBe(expectedUrl1);
        verifyOAuthRequestBody(firstCall[1]?.body as URLSearchParams);

        expect(fetch).toHaveBeenCalledWith(expectedUrl2, oAuthAuthenticationHeaders, EntityType.DOCUMENT);

        expect(actual).toEqual({
          sys_id: ARTICLE_SYS_ID,
          number: ARTICLE_NUMBER,
        });
      });

      it('should refresh token and successfully fetch article when token is expired', async () => {
        mockApiResponse(200, {
          access_token: ACCESS_TOKEN,
          expires_in: -1 * TEN_DAYS_IN_SEC,
          refresh_token: REFRESH_TOKEN
        } as ServiceNowAccessTokenResponse);

        mockApiResponse(200, {
          access_token: NEW_ACCESS_TOKEN,
          expires_in: TEN_DAYS_IN_SEC,
          refresh_token: REFRESH_TOKEN
        } as ServiceNowAccessTokenResponse);

        mockApiResponse(200, {
          result: {
            sys_id: ARTICLE_SYS_ID,
            number: ARTICLE_NUMBER,
          },
        } as ServiceNowSingleArticleResponse);

        await api.initialize(config, context);
        const actual = await api.getArticle(ARTICLE_SYS_ID);

        const expectedUrl1 = 'https://test-url.com/oauth_token.do';
        const expectedUrl2 = `https://test-url.com/api/sn_km_api/knowledge/articles/${ARTICLE_SYS_ID}`;
        const oAuthAuthenticationHeadersWithNewToken = {
          Authorization: `Bearer ${NEW_ACCESS_TOKEN}`,
        };

        expect(fetch).toHaveBeenCalledTimes(3);

        // Verify initial authentication call
        const firstCall = mockFetch.mock.calls[0];
        expect(firstCall[0]).toBe(expectedUrl1);
        verifyOAuthRequestBody(firstCall[1]?.body as URLSearchParams);

        // Verify token refresh call
        const secondCall = mockFetch.mock.calls[1];
        expect(secondCall[0]).toBe(expectedUrl1);
        verifyOAuthRequestBody(secondCall[1]?.body as URLSearchParams, true);

        // Verify article fetch call
        const thirdCall = mockFetch.mock.calls[2];
        expect(thirdCall[0]).toBe(expectedUrl2);
        expect(thirdCall[1]?.headers).toEqual(oAuthAuthenticationHeadersWithNewToken);

        // Verify response
        expect(actual).toEqual({
          sys_id: ARTICLE_SYS_ID,
          number: ARTICLE_NUMBER,
        });
      });

      describe('On authentication error', () => {
        it('should throw error when SERVICENOW_CLIENT_ID is missing from config', async () => {
          config.servicenowClientId = undefined;
          await checkValidationError('Missing SERVICENOW_CLIENT_ID from config');
        });

        it('should throw error when SERVICENOW_CLIENT_SECRET is missing from config', async () => {
          config.servicenowClientSecret = undefined;
          await checkValidationError('Missing SERVICENOW_CLIENT_SECRET from config');
        });

        it('should throw error when SERVICENOW_USERNAME is missing from config', async () => {
          config.servicenowUsername = undefined;
          await checkValidationError('Missing SERVICENOW_USERNAME from config');
        });

        it('should throw error when SERVICENOW_PASSWORD is missing from config', async () => {
          config.servicenowPassword = undefined;
          await checkValidationError('Missing SERVICENOW_PASSWORD from config');
        });

        it('should throw error credentials are invalid', async () => {
          mockApiResponse(500, 'Error message');

          try {
            await api.initialize(config, context);
            expect(true).toBe(false);
          } catch (error) {
            expect((error as InvalidCredentialsError).toFailedEntityErrors()[0].code).toEqual(ErrorCodes.THIRD_PARTY_INVALID_CREDENTIALS);
            expect((error as InvalidCredentialsError)
              .toFailedEntityErrors()[0].messageWithParams).toEqual('Failed to get ServiceNow bearer token. Reason: Api request [https://test-url.com/oauth_token.do] failed with status [500] and message [Error message]');
          }
          checkFetchToken();
        });

        it('should throw error when access token is missing', async () => {
          mockApiResponse(200, {} as ServiceNowAccessTokenResponse);

          try {
            await api.initialize(config, context);
            expect(true).toBe(false);
          } catch (error) {
            expect((error as InvalidCredentialsError).toFailedEntityErrors()[0].code).toEqual(ErrorCodes.THIRD_PARTY_INVALID_CREDENTIALS);
            expect((error as InvalidCredentialsError).toFailedEntityErrors()[0].messageWithParams).toContain('Access token not found in the response:');
          }
          checkFetchToken();
        });
      });
    });
  });

  function checkFetchUrl(expectedUrl: string, entityType: EntityType, isOAuth = false): void {
    const headers = isOAuth ? oAuthAuthenticationHeaders : basicAuthenticationHeaders;
    expect(fetch).toHaveBeenCalledWith(expectedUrl, headers, entityType);
  }

  async function checkValidationError(errorMessage: string): Promise<void> {
    try {
      await api.initialize(config, context);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as ValidationError).toFailedEntityErrors()[0].code).toEqual(ErrorCodes.VALIDATION_ERROR);
      expect((error as ValidationError).toFailedEntityErrors()[0].messageWithParams).toEqual(errorMessage);
    }
  }

  function checkFetchToken(): void {
    const expectedUrl = 'https://test-url.com/oauth_token.do';
    expect(fetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(expectedUrl);
    verifyOAuthRequestBody(call[1]?.body as URLSearchParams);
  }

  function verifyOAuthRequestBody(
    requestBody: URLSearchParams,
    isRefreshToken = false
  ) {
    expect(requestBody.get('client_id')).toBe('test-client-id');
    expect(requestBody.get('client_secret')).toBe('test-client-secret');
    if (isRefreshToken) {
      expect(requestBody.get('grant_type')).toBe('refresh_token');
      expect(requestBody.get('refresh_token')).toBe(REFRESH_TOKEN);
      expect(requestBody.get('username')).toBeNull();
      expect(requestBody.get('password')).toBeNull();
    } else {
      expect(requestBody.get('grant_type')).toBe('password');
      expect(requestBody.get('password')).toBe('password');
      expect(requestBody.get('username')).toBe('user');
      expect(requestBody.get('refresh_token')).toBeNull();
    }
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
