import { beforeEach, describe, expect, it } from '@jest/globals';
import { NopeAuthenticationProvider } from './nope-authentication-provider.js';

describe('NopeAuthenticationProvider', () => {
  let provider: NopeAuthenticationProvider<Record<string, string>>;

  beforeEach(() => {
    provider = new NopeAuthenticationProvider();
  });

  describe('authenticate()', () => {
    it('should return an empty object in a resolved promise', async () => {
      expect(await provider.authenticate()).toEqual({});
    });
  });

  describe('getHeaders()', () => {
    it('should add authorization header', () => {
      expect(provider.constructHeaders()).resolves.toEqual({});
    });
  });
});
