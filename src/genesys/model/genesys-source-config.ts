import { Config } from '../../config.js';

export interface GenesysSourceConfig extends Config {
  genesysSourceLoginUrl?: string;
  genesysSourceBaseUrl?: string;
  genesysSourceClientId?: string;
  genesysSourceClientSecret?: string;
  genesysSourceKnowledgeBaseId?: string;
}
