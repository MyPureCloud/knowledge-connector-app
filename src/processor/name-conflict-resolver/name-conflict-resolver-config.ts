import { Config } from '../../config.js';

export interface NameConflictResolverConfig extends Config {
  nameConflictSuffix?: string;
}
