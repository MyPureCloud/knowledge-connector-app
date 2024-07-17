import { Adapter } from './adapter.js';

/**
 * Adapter to connect to source system
 */
export interface SourceAdapter<C, L, A> extends Adapter {
  getAllCategories(): Promise<C[]>;

  getAllLabels(): Promise<L[]>;

  getAllArticles(): Promise<A[]>;

  getDocumentLinkMatcherRegexp(): RegExp | undefined;
}
