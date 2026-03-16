import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OauthPasswordAuthenticationProvider } from './oauth-password-authentication-provider.js';
import { fetch, Response } from '../web-client.js';
import { URLSearchParams } from 'url';

jest.mock('../web-client.js');

describe('OauthPasswordAuthenticationProvider', () => {
  const CLIENT_ID = 'client-id';
  const CLIENT_SECRET = 'client-secret';
  const USERNAME = 'username';
  const PASSWORD = 'password';
  const REQUEST_TOKEN_URL = 'https://request-token-genesys.com/token';
  const ACCESS_TOKEN = 'access-token';
  const REFRESH_TOKEN = 'refresh-token';

  let provider: OauthPasswordAuthenticationProvider<TokenResponseModel>;
  let mockFetch: jest.Mock<typeof fetch>;

  beforeEach(() => {
    mockFetch = fetch as jest.Mock<typeof fetch>;

    provider = new OauthPasswordAuthenticationProvider(
      CLIENT_ID,
      CLIENT_SECRET,
      USERNAME,
      PASSWORD,
      REQUEST_TOKEN_URL,
      {
        parse: ({
          access_token,
          refresh_token,
          expires_in,
        }: TokenResponseModel) => ({
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAtInMs: Date.now() + expires_in * 1000,
        }),
      },
    );
  });

  describe('authenticate()', () => {
    it('should return the requested token', async () => {
      mockSuccessRequest();

      expect(await provider.authenticate()).toEqual({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: expect.any(Number),
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        REQUEST_TOKEN_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            username: USERNAME,
            password: PASSWORD,
          }),
        },
        undefined,
      );
    });
  });

  describe('getHeaders()', () => {
    it('should add authorization header', async () => {
      mockSuccessRequest();
      await provider.authenticate();

      await expect(provider.constructHeaders()).resolves.toEqual({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh expired access token', async () => {
      mockSuccessRequest(-1);
      await provider.authenticate();
      mockSuccessRequest();

      await expect(provider.constructHeaders()).resolves.toEqual({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  function mockSuccessRequest(expiresIn: number = 3600) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: ACCESS_TOKEN,
            refresh_token: REFRESH_TOKEN,
            expires_in: expiresIn,
          } as TokenResponseModel),
        ),
    } as Response);
  }
});

interface TokenResponseModel {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
