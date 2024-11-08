import { beforeEach, describe, expect, it } from '@jest/globals';
import { readResponse, Response } from './web-client';
import { ApiError } from '../adapter/errors/api-error';

describe('WebClient', () => {
  const URL = 'https://some-random-url.genesys.com';
  const RESPONSE_BODY = {
    prop: 'value',
  };
  const RESPONSE_BODY_RAW = JSON.stringify(RESPONSE_BODY);
  const NON_JSON_RESPONSE_BODY = '<something><inside></inside></something>';

  beforeEach(() => {});

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
          ),
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
