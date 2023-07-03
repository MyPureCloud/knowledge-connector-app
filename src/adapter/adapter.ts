import { Config } from '../config.js';

/**
 * Generic adapter interface
 */
export interface Adapter {
  initialize(config: Config): Promise<void>;
}
