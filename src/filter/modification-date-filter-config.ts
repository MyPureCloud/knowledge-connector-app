import { Config } from '../config.js';
import { CompareMode } from '../utils/compare-mode.js';

export interface ModificationDateFilterConfig extends Config {
  compareMode?: CompareMode;
}
