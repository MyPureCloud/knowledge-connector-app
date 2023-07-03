import { Config } from '../config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContents } from '../model/importable-contents.js';
import { Task } from '../pipe/task.js';

/**
 * Uploader is the final {@Link Task} in the process. It calls Genesys Knowledge's API to do the necessary changes.
 */
export interface Uploader extends Task<ImportableContents, void> {
  initialize(
    config: Config,
    adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void>;

  run(importableContents: ImportableContents): Promise<void>;
}
