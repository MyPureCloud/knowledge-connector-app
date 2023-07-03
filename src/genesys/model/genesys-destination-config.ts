import { Config } from '../../config.js';

export interface GenesysDestinationConfig extends Config {
  genesysLoginUrl?: string;
  genesysBaseUrl?: string;
  genesysClientId?: string;
  genesysClientSecret?: string;
  genesysKnowledgeBaseId?: string;
}
