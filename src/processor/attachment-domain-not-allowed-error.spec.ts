import { describe, expect, it } from '@jest/globals';
import { AttachmentDomainNotAllowedError } from './attachment-domain-not-allowed-error.js';

describe('AttachmentDomainNotAllowedError', function () {
  it('should work with instanceof operator', function () {
    try {
      throw new AttachmentDomainNotAllowedError(
        'https://api-cdn.mypurecloud.com/image1.jpg',
      );
    } catch (error) {
      expect(error instanceof AttachmentDomainNotAllowedError).toBe(true);
      expect((<Error>error).message).toBe(
        'Skipped downloading attachment, domain not allowed: https://api-cdn.mypurecloud.com/image1.jpg',
      );
    }
  });
});
