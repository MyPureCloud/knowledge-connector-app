import { Config } from '../../config.js';

export interface GenesysSourceConfig extends Config {
  sourceUserAgent?: string;
  genesysSourceLoginUrl?: string;
  genesysSourceBaseUrl?: string;
  genesysSourceClientId?: string;
  genesysSourceClientSecret?: string;
  genesysSourceKnowledgeBaseId?: string;
}
