import { Adapter } from './adapter.js';
import { ExternalContent } from '../model';

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
