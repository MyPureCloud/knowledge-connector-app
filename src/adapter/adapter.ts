import { Config } from '../config.js';
import { Context } from '../context/context.js';

/**
 * Generic adapter interface
 */
export interface Adapter {
  initialize(config: Config, context: Context): Promise<void>;
}
