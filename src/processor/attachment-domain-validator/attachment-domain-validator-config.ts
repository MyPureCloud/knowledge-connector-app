import { Config } from '../../config.js';

export interface AttachmentDomainValidatorConfig extends Config {
  attachmentDomainAllowList?: string;
}
