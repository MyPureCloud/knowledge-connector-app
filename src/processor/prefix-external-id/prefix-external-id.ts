import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import { PrefixExternalIdConfig } from './prefix-external-id-config.js';
import { ExternalIdentifiable } from '../../model/external-identifiable.js';
import { Category, Document, Label } from '../../model';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';

/**
 * Processor to extend every external ID with given prefix. Use EXTERNAL_ID_PREFIX in configuration.
 * This configured prefix is used to distinguish between documents coming from different sources.
 * Only remove obsolete documents if it's source is the same as the currently processed source.
 */
export class PrefixExternalId implements Processor {
  private config: PrefixExternalIdConfig = {};
  private externalIdPrefix: string | null = null;

  public async initialize(
    config: PrefixExternalIdConfig,
    _adapters: AdapterPair<Adapter, Adapter>,
    _context: PipeContext,
  ): Promise<void> {
    this.config = config;
    this.externalIdPrefix = this.config.externalIdPrefix || null;
  }

  public async runOnCategory(item: Category): Promise<Category> {
    return this.replaceExternalId(item);
  }

  public async runOnLabel(item: Label): Promise<Label> {
    return this.replaceExternalId(item);
  }

  public async runOnDocument(item: Document): Promise<Document> {
    return this.replaceExternalId(item);
  }

  private replaceExternalId<T extends ExternalIdentifiable>(item: T): T {
    if (this.externalIdPrefix) {
      item.externalId = this.externalIdPrefix + item.externalId;
    }
    return item;
  }

  public getPriority(): number {
    return 10000; // should run first
  }
}
