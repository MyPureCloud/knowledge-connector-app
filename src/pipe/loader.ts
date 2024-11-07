import { Config } from '../config.js';
import { Adapter } from '../adapter/adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Task } from './task.js';
import { Category } from '../model/category.js';
import { Document } from '../model/document.js';
import { Label } from '../model/label.js';
import { AdapterContext } from '../adapter/adapter-context.js';

/**
 * Loaders are responsible for fetching data from source system
 */
export interface Loader extends Task {
  initialize(
    config: Config,
    adapters: AdapterPair<Adapter, Adapter>,
    context: AdapterContext<unknown, unknown, unknown>,
  ): Promise<void>;

  categoryIterator(): AsyncGenerator<Category, void, void>;

  labelIterator(): AsyncGenerator<Label, void, void>;

  documentIterator(): AsyncGenerator<Document, void, void>;
}
