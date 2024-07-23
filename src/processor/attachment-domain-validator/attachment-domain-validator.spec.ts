import { describe, expect, it } from '@jest/globals';
import { AttachmentDomainValidator } from './attachment-domain-validator.js';

describe('AttachmentDomainValidator', function () {
  it('should not validate if the config value is missing', function () {
    const validator = new AttachmentDomainValidator({});
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.com/image.jpg'),
    ).toBe(true);
  });

  it('should not validate if the config value is empty', function () {
    const validator = new AttachmentDomainValidator({
      attachmentDomainAllowList: '',
    });
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.com/image.jpg'),
    ).toBe(true);
  });

  it('should return true if the domain of the url listed in the config, false otherwise', function () {
    const validator = new AttachmentDomainValidator({
      attachmentDomainAllowList: 'api-cdn.mypurecloud.com',
    });
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.com/image.jpg'),
    ).toBe(true);
    expect(
      validator.isDomainAllowed('https://api-cdn.usw2.pure.cloud/image.jpg'),
    ).toBe(false);
  });

  it('should accept subdomains, but not different domains', function () {
    const validator = new AttachmentDomainValidator({
      attachmentDomainAllowList: 'api-cdn.mypurecloud.com',
    });
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.com/image.jpg'),
    ).toBe(true);
    expect(
      validator.isDomainAllowed(
        'https://subdomain.api-cdn.mypurecloud.com/image.jpg',
      ),
    ).toBe(true);
    expect(
      validator.isDomainAllowed('https://other.mypurecloud.com/image.jpg'),
    ).toBe(false);
    expect(
      validator.isDomainAllowed(
        'https://other-api-cdn.mypurecloud.com/image.jpg',
      ),
    ).toBe(false);
  });

  it('should split and trim config values', function () {
    const validator = new AttachmentDomainValidator({
      attachmentDomainAllowList:
        'api-cdn.mypurecloud.com, api-cdn.usw2.pure.cloud, api-cdn.sae1.pure.cloud ',
    });
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.com/image.jpg'),
    ).toBe(true);
    expect(
      validator.isDomainAllowed('https://api-cdn.usw2.pure.cloud/image.jpg'),
    ).toBe(true);
    expect(
      validator.isDomainAllowed('https://api-cdn.sae1.pure.cloud/image.jpg'),
    ).toBe(true);
    expect(
      validator.isDomainAllowed('https://api-cdn.mypurecloud.de/image.jpg'),
    ).toBe(false);
  });
});
