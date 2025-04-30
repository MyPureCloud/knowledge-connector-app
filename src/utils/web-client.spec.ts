import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  fetch,
  fetchImage,
  fetchSourceResource,
  fetchDestinationResource,
  readResponse,
  Response,
} from './web-client.js';
import { ApiError } from '../adapter/errors/api-error.js';
import { Interrupted } from './errors/interrupted.js';
import { runtime } from './runtime.js';
import { Headers, MockAgent, setGlobalDispatcher } from 'undici';
import { configure } from './retry.js';
import { ContentType } from './content-type.js';
import { getPackageVersion } from './package-version';

jest.mock('./package-version.js');

describe('WebClient', () => {
  const URL = 'https://some-random-url.genesys.com';
  const RESPONSE_BODY = {
    prop: 'value',
  };
  const RESPONSE_BODY_RAW = JSON.stringify(RESPONSE_BODY);
  const NON_JSON_RESPONSE_BODY = '<something><inside></inside></something>';

  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    configure(1);
  });

  afterEach(async () => {
    await mockAgent.close();
    configure();
  });

  describe('readResponse', () => {
    it('should parse response body', async () => {
      const response = await readResponse<object>(
        URL,
        mockResponse(200, RESPONSE_BODY_RAW),
      );

      expect(response).toStrictEqual(RESPONSE_BODY);
    });

    describe('when status not ok', () => {
      it('should throw with response body', async () => {
        await expect(() =>
          readResponse<object>(URL, mockResponse(404, RESPONSE_BODY_RAW)),
        ).rejects.toThrowError(
          new ApiError(
            `Api request [${URL}] failed with status [404] and message [${RESPONSE_BODY_RAW}]`,
            {
              url: URL,
              status: 404,
              message: `API request failed with status: 404`,
              body: RESPONSE_BODY_RAW,
            },
          ),
        );
      });

      describe('when response body missing', () => {
        it('should throw with response status', async () => {
          await expect(() =>
            readResponse<object>(URL, {
              ok: false,
              status: 419,
              text: () =>
                Promise.reject(new Error('Cannot read response body')),
            } as Response),
          ).rejects.toThrowError(
            new ApiError(
              `Api request [${URL}] failed to read body from response with status [419] - Error: Cannot read response body`,
              {
                url: URL,
                status: 419,
                message: 'Error: Cannot read response body',
              },
              undefined,
              Error('Cannot read response body'),
            ),
          );
        });
      });
    });

    describe('when response body cannot be parsed', () => {
      it('should throw with raw response body', async () => {
        await expect(() =>
          readResponse<object>(URL, mockResponse(200, NON_JSON_RESPONSE_BODY)),
        ).rejects.toThrowError(
          new ApiError(
            `Api request [${URL}] failed to parse body [${NON_JSON_RESPONSE_BODY}] - SyntaxError: Unexpected token < in JSON at position 0`,
            {
              url: URL,
              status: 200,
              message: 'SyntaxError: Unexpected token < in JSON at position 0',
              body: NON_JSON_RESPONSE_BODY,
            },
            undefined,
            SyntaxError('Unexpected token < in JSON at position 0'),
          ),
        );
      });
    });
  });

  describe('User Agent header', () => {
    describe('when it is set in env var', () => {
      it('should be set by fetchSourceResource', async () => {
        process.env.SOURCE_USER_AGENT = "SOURCE_USER_AGENT"
        let capturedHeaders: Headers | Record<string, string> | undefined = {};

        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, (opts) => {
            capturedHeaders = opts.headers;
            return JSON.stringify({});
          })
          .times(1);

        await fetchSourceResource(
          URL,
          {
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer token123',
            },
          },
          undefined,
          ContentType.JSON,
        );

        expect(capturedHeaders['User-Agent']).toBe(process.env.SOURCE_USER_AGENT);
        mockAgent.assertNoPendingInterceptors();
      });

      it('should be set by fetchDestinationResource', async () => {
        process.env.DESTINATION_USER_AGENT = "DESTINATION_USER_AGENT"
        let capturedHeaders: Headers | Record<string, string> | undefined = {};

        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, (opts) => {
            capturedHeaders = opts.headers;
            return JSON.stringify({});
          })
          .times(1);

        await fetchDestinationResource(
          URL,
          {
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer token123',
            },
          },
          undefined,
          ContentType.JSON,
        );

        expect(capturedHeaders['User-Agent']).toBe(
          process.env.DESTINATION_USER_AGENT,
        );
        mockAgent.assertNoPendingInterceptors();
      });
    });

    describe('when it is not set in env var', () => {
      const packageVersion = getPackageVersion();
      const nodeVersion = process.version;

      it('should be set to default by fetchSourceResource', async () => {
        delete process.env.SOURCE_USER_AGENT
        let capturedHeaders: Headers | Record<string, string> | undefined = {};

        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, (opts) => {
            capturedHeaders = opts.headers;
            return JSON.stringify({});
          })
          .times(1);

        await fetchSourceResource(
          URL,
          {
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer token123',
            },
          },
          undefined,
          ContentType.JSON,
        );

        expect(capturedHeaders['User-Agent']).toBe(
          `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`,
        );
        mockAgent.assertNoPendingInterceptors();
      });

      it('should be set to default by fetchDestinationResource', async () => {
        delete process.env.DESTINATION_USER_AGENT
        let capturedHeaders: Headers | Record<string, string> | undefined = {};

        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, (opts) => {
            capturedHeaders = opts.headers;
            return JSON.stringify({});
          })
          .times(1);

        await fetchDestinationResource(
          URL,
          {
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer token123',
            },
          },
          undefined,
          ContentType.JSON,
        );

        expect(capturedHeaders['User-Agent']).toBe(
          `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`,
        );
        mockAgent.assertNoPendingInterceptors();
      });
    });
  });

  describe('fetchDestinationResource', () => {
    describe('when content type is JSON', () => {
      it('should resolve with response', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, JSON.stringify({}))
          .times(1);

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.JSON,
        );

        expect(actual).toStrictEqual({});
        mockAgent.assertNoPendingInterceptors();
      });

      describe('when unparsable', () => {
        it('should reject', async () => {
          mockAgent
            .get(URL)
            .intercept({ method: 'GET', path: '/' })
            .reply(200, 'some none JSON response')
            .times(6);

          await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
            new ApiError(
              'Api request [https://some-random-url.genesys.com] failed to parse body [some none JSON response] - SyntaxError: Unexpected token s in JSON at position 0',
              {},
              undefined,
              new Error('Unexpected token s in JSON at position 0'),
            ),
          );

          mockAgent.assertNoPendingInterceptors();
        });
      });
    });

    describe('when content type is text', () => {
      it('should resolve with response', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, 'text response')
          .times(1);

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.TEXT,
        );

        expect(actual).toBe('text response');
        mockAgent.assertNoPendingInterceptors();
      });
    });

    describe('when content type is blob', () => {
      it('should resolve with response', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, 'text response')
          .times(1);

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.BLOB,
        );

        expect(actual).toBeInstanceOf(Blob);
        mockAgent.assertNoPendingInterceptors();
      });
    });

    describe('when status 2XX', () => {
      it('should resolve with response', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, JSON.stringify({}))
          .times(1);

        await fetchDestinationResource(URL);

        mockAgent.assertNoPendingInterceptors();
      });
    });

    describe('when status 4XX', () => {
      it('should not retry', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(404, JSON.stringify({}))
          .times(1);

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          new ApiError(
            `Api request [https://some-random-url.genesys.com] failed with status [404] and message [{}]`,
            {
              url: 'https://some-random-url.genesys.com',
              status: 404,
            },
          ),
        );

        mockAgent.assertNoPendingInterceptors();
      });
    });

    describe('when status 5XX', () => {
      it('should retry', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(503, JSON.stringify({}))
          .times(6);

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(ApiError);

        mockAgent.assertNoPendingInterceptors();
      }, 10000);
    });

    describe('when response cannot be parsed', () => {
      it('should retry', async () => {
        mockAgent
          .get(URL)
          .intercept({ method: 'GET', path: '/' })
          .reply(200, '<html></html>')
          .times(6);

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          new ApiError(
            'Api request [https://some-random-url.genesys.com] failed to parse body [<html></html>] - SyntaxError: Unexpected token < in JSON at position 0',
            {},
            undefined,
            new Error('Unexpected token < in JSON at position 0'),
          ),
        );

        mockAgent.assertNoPendingInterceptors();
      }, 10000);
    });

    describe('when interrupted', () => {
      beforeEach(() => {
        runtime.interrupt();
      });

      afterEach(() => {
        runtime.reset();
      });

      it('should not retry', async () => {
        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(Interrupted);

        mockAgent.assertNoPendingInterceptors();
      });
    });
  });

  describe('when interruption', () => {
    beforeEach(() => {
      runtime.interrupt();
    });

    afterEach(() => {
      runtime.reset();
    });

    describe('fetch', () => {
      it('should throw Interrupted', async () => {
        await expect(async () => await fetch('', {})).rejects.toThrow(
          Interrupted,
        );
      });
    });

    describe('fetchImage', () => {
      it('should throw Interrupted', async () => {
        await expect(async () => await fetchImage('', {})).rejects.toThrow(
          Interrupted,
        );
      });
    });
  });

  function mockResponse(status: number, raw: string): Response {
    return {
      ok: status === 200,
      status,
      text: () => Promise.resolve(raw),
    } as Response;
  }
});
