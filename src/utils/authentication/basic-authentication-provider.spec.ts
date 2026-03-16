import { beforeEach, describe, expect, it } from '@jest/globals';
import { BasicAuthenticationProvider } from './basic-authentication-provider.js';

describe('BasicAuthenticationProvider', () => {
  let provider: BasicAuthenticationProvider<Record<string, string>>;

  beforeEach(() => {
    provider = new BasicAuthenticationProvider('username', 'password');
  });

  describe('authenticate()', () => {
    it('should return an empty object in a resolved promise', async () => {
      expect(await provider.authenticate()).toEqual({});
    });
  });

  describe('getHeaders()', () => {
    it('should add authorization header', () => {
      expect(provider.constructHeaders()).resolves.toEqual({
        Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
      });
    });
  });
});
