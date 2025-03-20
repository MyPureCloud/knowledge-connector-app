import { Filter } from './filter.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { CompareMode } from '../utils/compare-mode.js';
import { Category, Document, Label } from '../model';
import { ModificationDateFilterConfig } from './modification-date-filter-config.js';

export class ModificationDateFilter implements Filter {
  private context?: PipeContext;
  private config?: ModificationDateFilterConfig;
  private compareMode?: CompareMode;
  private externalIdPrefix?: string;

  public async initialize(
    config: ModificationDateFilterConfig,
    _adapters: AdapterPair<Adapter, DestinationAdapter>,
    context: PipeContext,
  ): Promise<void> {
    this.context = context;
    this.config = config;
    this.compareMode = this.config.compareMode ?? CompareMode.MODIFICATION_DATE;
    this.externalIdPrefix = config.externalIdPrefix ?? undefined;
  }

  public async runOnCategory(_content: Category): Promise<boolean> {
    return true;
  }

  public async runOnLabel(_content: Label): Promise<boolean> {
    return true;
  }

  public async runOnDocument(content: Document): Promise<boolean> {
    if (this.compareMode !== CompareMode.MODIFICATION_DATE) {
      return true;
    }

    const { documents: storedDocuments = [] } = this.context!.storedContent || {};
    const prefixedExternalId = this.getPrefixedExternalId(content.externalId);

    const storedDocument =
      storedDocuments.find((storedItem) =>
        storedItem && (storedItem.externalId === prefixedExternalId));

    if (this.externalVersionIdsMatch(content, storedDocument)) {
      this.removeFromDeletedDocuments(prefixedExternalId);
      return false;
    }
    return true;
  }

  private getPrefixedExternalId(externalId: string | null): string | null {
    return this.externalIdPrefix ? this.externalIdPrefix + externalId : externalId;
  }

  private externalVersionIdsMatch(content: Document, storedDocument?: Document): boolean {
    return !!(
      storedDocument &&
      content.externalVersionId && storedDocument.externalVersionId &&
      content.externalVersionId === storedDocument.externalVersionId
    );
  }

  private removeFromDeletedDocuments(externalId: string | null): void {
    const index = this.context!.syncableContents.documents.deleted.findIndex(
      document => document.externalId === externalId
    );

    if (index !== -1) {
      this.context!.syncableContents.documents.deleted.splice(index, 1);
    }
  }
}
