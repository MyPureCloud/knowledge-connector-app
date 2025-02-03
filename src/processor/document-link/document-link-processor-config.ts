import { PrefixExternalIdConfig } from '../prefix-external-id/prefix-external-id-config.js';

export interface DocumentLinkProcessorConfig extends PrefixExternalIdConfig {
  updateDocumentLinks?: string;
}
