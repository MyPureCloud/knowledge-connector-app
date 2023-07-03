import { Config } from '../config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';

/**
 * Task is the base interface for every class that can be passed into the {@link Pipe}
 * See also:
 *    {@link Loader}
 *    {@link Processor}
 *    {@link Aggregator}
 *    {@link Uploader}
 */
export interface Task<I, O> {
  initialize(
    config: Config,
    adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void>;

  run(input: I): Promise<O>;
}
