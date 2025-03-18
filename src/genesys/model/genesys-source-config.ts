import { Config } from '../../config.js';
import { CompareMode } from '../../utils/compare-mode.js';

export interface GenesysSourceConfig extends Config {
  genesysSourceLoginUrl?: string;
  genesysSourceBaseUrl?: string;
  genesysSourceClientId?: string;
  genesysSourceClientSecret?: string;
  genesysSourceKnowledgeBaseId?: string;
  compareMode?: CompareMode;
}
