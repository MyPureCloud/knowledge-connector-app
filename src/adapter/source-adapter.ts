import { Adapter } from './adapter.js';
import { ExternalLink } from '../model/external-link.js';

/**
 * Adapter to connect to source system
 */
export interface SourceAdapter<C, L, A> extends Adapter {
  categoryIterator(): AsyncGenerator<C, void, void>;

  labelIterator(): AsyncGenerator<L, void, void>;

  articleIterator(): AsyncGenerator<A, void, void>;

  getDocumentLinkMatcherRegexp(): RegExp | undefined;

  getResourceBaseUrl(): string;

  constructDocumentLink(id: string): Promise<ExternalLink | null>;
}
