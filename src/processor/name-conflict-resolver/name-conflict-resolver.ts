import { Category, Document, Label, NamedEntity } from '../../model';
import { validateNonNull } from '../../utils/validate-non-null.js';
import { NameConflictResolverConfig } from './name-conflict-resolver-config.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';

export class NameConflictResolver implements Processor {
  private context?: PipeContext;
  private nameConflictSuffix: string | null = null;

  public async initialize(
    config: NameConflictResolverConfig,
    _adapters: AdapterPair<Adapter, Adapter>,
    context: PipeContext,
  ): Promise<void> {
    this.context = context;
    this.nameConflictSuffix = config.nameConflictSuffix || null;
  }

  public async runOnCategory(item: Category): Promise<Category> {
    const allItems = [
      ...this.context!.pipe.processedItems.categories,
      ...(this.context!.storedContent?.categories || []),
    ];

    this.validateName(item, allItems);

    return item;
  }

  public async runOnLabel(item: Label): Promise<Label> {
    const allItems = [
      ...this.context!.pipe.processedItems.labels,
      ...(this.context!.storedContent?.labels || []),
    ];

    this.validateName(item, allItems);

    return item;
  }

  public async runOnDocument(item: Document): Promise<Document> {
    return item;
  }

  public getPriority(): number {
    return 0;
  }

  private validateName<T extends NamedEntity>(item: T, allItems: T[]): void {
    if (this.hasNameConflict(item, allItems)) {
      this.resolveNameConflict(item, allItems);
    }
  }

  private resolveNameConflict<T extends NamedEntity>(
    item: T,
    allItems: T[],
  ): void {
    validateNonNull(
      this.nameConflictSuffix,
      `Name conflict found "${item.name}". Try to use "NAME_CONFLICT_SUFFIX" variable`,
    );

    while (this.hasNameConflict(item, allItems)) {
      item.name += this.nameConflictSuffix!;
    }
  }

  private hasNameConflict<T extends NamedEntity>(
    collectedItem: T,
    storedItems: T[],
  ): boolean {
    return !!storedItems.find(
      (currentItem) =>
        currentItem &&
        currentItem.name?.toLowerCase() === collectedItem.name?.toLowerCase() &&
        currentItem.externalId !== collectedItem.externalId,
    );
  }
}
