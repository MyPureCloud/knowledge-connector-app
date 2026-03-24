import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  fetchDestinationResource,
  fetchImage,
  fetchSourceResource,
  readResponse,
  request,
} from './web-client.js';
import { ApiError } from '../adapter/errors/api-error.js';
import { Interrupted } from './errors/interrupted.js';
import { runtime } from './runtime.js';
import { configure } from './retry.js';
import { ContentType } from './content-type.js';
import { getPackageVersion } from './package-version.js';

jest.mock('./package-version.js');

describe('WebClient', () => {
  const URL = 'https://some-random-url.genesys.com';
  const RESPONSE_BODY = {
    prop: 'value',
  };
  const RESPONSE_BODY_RAW = JSON.stringify(RESPONSE_BODY);
  const NON_JSON_RESPONSE_BODY = '<something><inside></inside></something>';

  let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    configure(1);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    configure();
  });

  function stubFetch(status: number, body: string): void {
    fetchSpy.mockResolvedValueOnce(new Response(body, { status }));
  }

  function stubFetchTimes(status: number, body: string, times: number): void {
    for (let i = 0; i < times; i++) {
      stubFetch(status, body);
    }
  }

  function getCapturedHeaders(): Headers {
    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit | undefined;
    return new Headers(init?.headers);
  }

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
        ).rejects.toThrow(
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
          ).rejects.toThrow(
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
        ).rejects.toThrow(
          new ApiError(
            `Api request [${URL}] failed to parse body [${NON_JSON_RESPONSE_BODY}] - SyntaxError: Unexpected token '<', "<something"... is not valid JSON`,
            {
              url: URL,
              status: 200,
              message: `SyntaxError: Unexpected token '<', "<something"... is not valid JSON`,
              body: NON_JSON_RESPONSE_BODY,
            },
            undefined,
            SyntaxError(
              `Unexpected token '<', "<something"... is not valid JSON`,
            ),
          ),
        );
      });
    });
  });

  describe('User Agent header', () => {
    describe('when it is set in env var', () => {
      it('should be set by fetchSourceResource', async () => {
        process.env.SOURCE_USER_AGENT = 'SOURCE_USER_AGENT';
        stubFetch(200, JSON.stringify({}));

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

        expect(getCapturedHeaders().get('User-Agent')).toBe(
          process.env.SOURCE_USER_AGENT,
        );

        expect(fetchSpy.mock.calls.length).toBe(1);
      });

      it('should be set by fetchDestinationResource', async () => {
        process.env.DESTINATION_USER_AGENT = 'DESTINATION_USER_AGENT';
        stubFetch(200, JSON.stringify({}));

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

        expect(getCapturedHeaders().get('User-Agent')).toBe(
          process.env.DESTINATION_USER_AGENT,
        );

        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });

    describe('when it is not set in env var', () => {
      const packageVersion = getPackageVersion();
      const nodeVersion = process.version;

      it('should be set to default by fetchSourceResource', async () => {
        delete process.env.SOURCE_USER_AGENT;
        stubFetch(200, JSON.stringify({}));

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

        expect(getCapturedHeaders().get('User-Agent')).toBe(
          `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`,
        );
        expect(fetchSpy.mock.calls.length).toBe(1);
      });

      it('should be set to default by fetchDestinationResource', async () => {
        delete process.env.DESTINATION_USER_AGENT;
        stubFetch(200, JSON.stringify({}));

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

        expect(getCapturedHeaders().get('User-Agent')).toBe(
          `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`,
        );
        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });
  });

  describe('fetchDestinationResource', () => {
    describe('when content type is JSON', () => {
      it('should resolve with response', async () => {
        stubFetch(200, JSON.stringify({}));

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.JSON,
        );

        expect(actual).toStrictEqual({});
        expect(fetchSpy.mock.calls.length).toBe(1);
      });

      describe('when unparsable', () => {
        it('should reject', async () => {
          stubFetchTimes(200, 'some none JSON response', 6);

          await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
            new ApiError(
              `Api request [https://some-random-url.genesys.com] failed to parse body [some none JSON response] - SyntaxError: Unexpected token 's', "some none "... is not valid JSON`,
              {
                url: 'https://some-random-url.genesys.com',
                status: 200,
                message: `SyntaxError: Unexpected token 's', "some none "... is not valid JSON`,
                body: 'some none JSON response',
              },
              undefined,
              new Error(
                `Unexpected token 's', "some none "... is not valid JSON`,
              ),
            ),
          );
          expect(fetchSpy.mock.calls.length).toBe(6);
        });
      });
    });

    describe('when content type is text', () => {
      it('should resolve with response', async () => {
        stubFetch(200, 'text response');

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.TEXT,
        );

        expect(actual).toBe('text response');
        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });

    describe('when content type is blob', () => {
      it('should resolve with response', async () => {
        stubFetch(200, 'text response');

        const actual = await fetchDestinationResource(
          URL,
          {},
          undefined,
          ContentType.BLOB,
        );

        expect(actual).toBeInstanceOf(Blob);
        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });

    describe('when status 2XX', () => {
      it('should resolve with response', async () => {
        stubFetch(200, JSON.stringify({}));

        await fetchDestinationResource(URL);
        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });

    describe('when status 4XX', () => {
      it('should not retry', async () => {
        stubFetch(404, JSON.stringify({}));

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          new ApiError(
            `Api request [https://some-random-url.genesys.com] failed with status [404] and message [{}]`,
            {
              url: 'https://some-random-url.genesys.com',
              status: 404,
            },
          ),
        );
        expect(fetchSpy.mock.calls.length).toBe(1);
      });
    });

    describe('when status 5XX', () => {
      it('should retry', async () => {
        stubFetchTimes(503, JSON.stringify({}), 6);

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          ApiError,
        );

        expect(fetchSpy.mock.calls.length).toBe(6);
      }, 10000);
    });

    describe('when response cannot be parsed', () => {
      it('should retry', async () => {
        stubFetchTimes(200, '<html></html>', 6);

        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          new ApiError(
            `Api request [https://some-random-url.genesys.com] failed to parse body [<html></html>] - SyntaxError: Unexpected token '<', "<html></html>" is not valid JSON`,
            {
              url: 'https://some-random-url.genesys.com',
              status: 200,
              message: `SyntaxError: Unexpected token '<', "<html></html>" is not valid JSON`,
              body: '<html></html>',
            },
            undefined,
            new Error(
              `Unexpected token '<', "<html></html>" is not valid JSON`,
            ),
          ),
        );

        expect(fetchSpy.mock.calls.length).toBe(6);
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
        await expect(() => fetchDestinationResource(URL)).rejects.toThrow(
          Interrupted,
        );

        expect(fetchSpy.mock.calls.length).toBe(0);
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
        await expect(async () => await request('', {})).rejects.toThrow(
          Interrupted,
        );

        expect(fetchSpy.mock.calls.length).toBe(0);
      });

      describe('interruptible false header set', () => {
        it('should not throw Interrupted', async () => {
          stubFetch(200, JSON.stringify({}));

          await request(URL, {
            headers: {
              interruptible: 'false',
            },
          });

          expect(getCapturedHeaders().has('interruptible')).toBeFalsy();
          expect(fetchSpy.mock.calls.length).toBe(1);
        });
      });
    });

    describe('fetchImage', () => {
      it('should throw Interrupted', async () => {
        await expect(async () => await fetchImage('', {})).rejects.toThrow(
          Interrupted,
        );

        expect(fetchSpy.mock.calls.length).toBe(0);
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
