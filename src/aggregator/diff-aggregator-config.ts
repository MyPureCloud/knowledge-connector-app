import { PrefixExternalIdConfig } from '../processor/prefix-external-id/prefix-external-id-config.js';
export interface DiffAggregatorConfig extends PrefixExternalIdConfig {
  protectedFields?: string;
  nameConflictSuffix?: string;
  allowPruneAllEntities?: string;
}
