import { AttachmentDomainValidatorConfig } from './attachment-domain-validator-config.js';

export class AttachmentDomainValidator {
  private attachmentDomainAllowList: string[];
  private enabled: boolean;

  constructor(config: AttachmentDomainValidatorConfig) {
    this.attachmentDomainAllowList = config.attachmentDomainAllowList
      ? config.attachmentDomainAllowList
          .split(',')
          .map((domain) => domain.trim())
      : [];
    this.enabled = this.attachmentDomainAllowList.length > 0;
  }

  public isDomainAllowed(url: string): boolean {
    if (!this.enabled) {
      return true;
    }
    try {
      const urlObject = new URL(url);
      return this.attachmentDomainAllowList.some(
        (domain) =>
          urlObject.host === domain || urlObject.host.endsWith('.' + domain),
      );
    } catch (error) {
      return false;
    }
  }
}
