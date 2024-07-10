import { Adapter } from './adapter.js';

/**
 * Adapter to connect to source system
 */
export interface SourceAdapter<C, L, A> extends Adapter {
  getAllCategories(): Promise<C[]>;

  getAllLabels(): Promise<L[]>;

  getAllArticles(): Promise<A[]>;

  extractDocumentIdFromUrl(
    articleLookupTable: Map<string, string>,
    hyperlink: string,
  ): string | undefined;
}
