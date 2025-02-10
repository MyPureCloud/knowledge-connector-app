import { Loader } from './loader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { Category, Document, Label } from '../model';
import { Config } from '../config.js';
import { LoaderConfig } from './loader-config.js';
import { AdapterContext } from '../adapter/adapter-context.js';
import { getLogger } from '../utils/logger.js';

export abstract class AbstractLoader<
  CTX extends AdapterContext<unknown, unknown, unknown>,
> implements Loader
{
  private _config: LoaderConfig = {};
  protected context: CTX | null = null;

  public async initialize(
    config: Config,
    _adapters: AdapterPair<Adapter, Adapter>,
    context: CTX,
  ): Promise<void> {
    this._config = config;
    this.context = context;
  }

  public abstract categoryIterator(): AsyncGenerator<Category, void, void>;

  public abstract documentIterator(): AsyncGenerator<Document, void, void>;

  public abstract labelIterator(): AsyncGenerator<Label, void, void>;

  protected async *loadItems<I, O>(
    iterator: AsyncGenerator<I, void, void>,
    mapper: (i: I) => O[],
    unprocessedItems: I[],
  ): AsyncGenerator<O, void, void> {
    for await (const item of iterator) {
      const result = mapper(item);
      if (result.length > 0) {
        for (const i of result) {
          yield i;
        }
      } else {
        unprocessedItems.push(item);
      }
    }

    getLogger().debug(
      `Processing ${unprocessedItems.length} postponed items in loader`,
    );
    while (unprocessedItems.length > 0) {
      const item = unprocessedItems[0];
      const result = mapper(item!);
      if (result.length > 0) {
        for (const i of result) {
          yield i;
        }
      }
      unprocessedItems.shift();
    }
  }

  protected shouldLoadArticles(): boolean {
    return this._config.fetchArticles !== 'false';
  }

  protected shouldLoadCategories(): boolean {
    return this._config.fetchCategories !== 'false';
  }

  protected shouldLoadLabels(): boolean {
    return this._config.fetchLabels !== 'false';
  }

  protected shouldBuildExternalUrls(): boolean {
    return this._config.buildExternalUrls === 'true';
  }
}
