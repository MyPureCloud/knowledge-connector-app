import { PrefixExternalIdConfig } from '../../processor/prefix-external-id/prefix-external-id-config.js';

export interface GenesysDestinationConfig extends PrefixExternalIdConfig {
  genesysLoginUrl?: string;
  genesysBaseUrl?: string;
  genesysClientId?: string;
  genesysClientSecret?: string;
  genesysKnowledgeBaseId?: string;
  genesysSourceId?: string;
  allowPruneAllEntities?: string;
}
