import { Filter } from './filter.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { Category, Document, Label } from '../model';
import { ModificationDateFilterConfig } from './modification-date-filter-config.js';
import { getLogger } from '../utils/logger.js';

export class DuplicateFilter implements Filter {
  private context?: PipeContext;
  private externalIdPrefix?: string;

  public async initialize(
    config: ModificationDateFilterConfig,
    _adapters: AdapterPair<Adapter, DestinationAdapter>,
    context: PipeContext,
  ): Promise<void> {
    this.context = context;
    this.externalIdPrefix = config.externalIdPrefix ?? undefined;
  }

  public async runOnCategory(_content: Category): Promise<boolean> {
    return true;
  }

  public async runOnLabel(_content: Label): Promise<boolean> {
    return true;
  }

  public async runOnDocument(content: Document): Promise<boolean> {
    const prefixedExternalId = this.getPrefixedExternalId(content.externalId);

    const duplicate =
      (this.context!.pipe.processedItems.documents || []).find(
        (item) =>
          item.externalId === prefixedExternalId ||
          item.externalId === content.externalId,
      ) ||
      (this.context!.pipe.unprocessedItems.documents || []).find(
        (item) =>
          item.externalId === prefixedExternalId ||
          item.externalId === content.externalId,
      );

    if (duplicate) {
      const {
        externalUrl: currentExternalUrl,
        externalIdAlternatives: currentExternalIdAlternatives,
        externalVersionId: currentExternalVersionId,
      } = content;
      const {
        externalUrl: originalExternalUrl,
        externalIdAlternatives: originalExternalIdAlternatives,
        externalVersionId: originalExternalVersionId,
      } = duplicate;

      getLogger().warn(
        `Duplicate document found with ID ${content.externalId}: ${JSON.stringify(
          {
            currentExternalUrl,
            originalExternalUrl,
            currentExternalIdAlternatives,
            originalExternalIdAlternatives,
            currentExternalVersionId,
            originalExternalVersionId,
          },
        )}`,
      );
      return false;
    }

    return true;
  }

  private getPrefixedExternalId(externalId: string | null): string | null {
    return this.externalIdPrefix
      ? this.externalIdPrefix + externalId
      : externalId;
  }
}
