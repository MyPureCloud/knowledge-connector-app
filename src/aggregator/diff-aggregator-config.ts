import { PrefixExternalIdConfig } from '../processor/prefix-external-id/prefix-external-id-config.js';
import { CompareMode } from '../utils/compare-mode.js';
export interface DiffAggregatorConfig extends PrefixExternalIdConfig {
  protectedFields?: string;
  compareMode?: CompareMode;
}
