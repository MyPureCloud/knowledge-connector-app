import { SourceAdapter } from './source-adapter.js';
import { Config } from '../config.js';
import { AdapterContext } from './adapter-context.js';

export abstract class AbstractSourceAdapter<C, L, A>
  implements SourceAdapter<C, L, A>
{
  public async initialize(
    _config: Config,
    context: AdapterContext<C, L, A>,
  ): Promise<void> {
    if (!context.adapter) {
      context.adapter = {
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      };
    }
  }

  public abstract categoryIterator(): AsyncGenerator<C, void, void>;

  public abstract labelIterator(): AsyncGenerator<L, void, void>;

  public abstract articleIterator(): AsyncGenerator<A, void, void>;

  public abstract getDocumentLinkMatcherRegexp(): RegExp | undefined;

  public abstract getResourceBaseUrl(): string;
}
