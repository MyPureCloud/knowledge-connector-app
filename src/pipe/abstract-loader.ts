import { Loader } from './loader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ExternalContent } from '../model';
import { Config } from '../config.js';
import { LoaderConfig } from './loader-config.js';

export abstract class AbstractLoader implements Loader {
  private _config: LoaderConfig = {};

  public async initialize(
    config: Config,
    _adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void> {
    this._config = config;
  }

  public abstract run(
    input: ExternalContent | undefined,
  ): Promise<ExternalContent>;

  protected shouldLoadArticles(): boolean {
    return this._config.fetchArticles !== 'false';
  }

  protected shouldLoadCategories(): boolean {
    return this._config.fetchCategories !== 'false';
  }

  protected shouldLoadLabels(): boolean {
    return this._config.fetchLabels !== 'false';
  }
}
