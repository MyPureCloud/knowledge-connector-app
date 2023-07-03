import { ExternalContent } from '../model/external-content.js';
import { Config } from '../config.js';
import { Adapter } from '../adapter/adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Task } from './task.js';

/**
 * Loaders are responsible for fetching data from source system
 */
export interface Loader
  extends Task<ExternalContent | undefined, ExternalContent> {
  initialize(
    config: Config,
    adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void>;

  run(input: ExternalContent | undefined): Promise<ExternalContent>;
}
