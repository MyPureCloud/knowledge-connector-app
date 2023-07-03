import { ExternalContent } from '../model/external-content.js';
import { Config } from '../config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';

/**
 * Processor is {@Link Task} that can perform any transformation before {@Link Aggregator} gets the {@Link ExternalContent}
 */
export interface Processor {
  initialize(
    config: Config,
    adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void>;

  run(content: ExternalContent): Promise<ExternalContent>;
}
