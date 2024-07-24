import { Aggregator } from './aggregator.js';
import { ExternalContent } from '../model/external-content.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import {
  ImportableContent,
  SyncableContents,
} from '../model/syncable-contents.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import _ from 'lodash';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import {
  Document,
  DocumentVersion,
  Variation,
} from '../model/sync-export-model.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { CategoryReference } from '../model/category-reference.js';
import { LabelReference } from '../model/label-reference.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { NamedEntity } from '../model/named-entity.js';
import { DiffAggregatorConfig } from './diff-aggregator-config.js';
import { extractLinkBlocksFromVariation } from '../utils/link-object-extractor.js';
import { getLogger } from '../utils/logger.js';

/**
 * The DiffAggregator transforms the ExternalContent into ImportableContents,
 * and filters out entities that have not been changed since last run.
 * It detects changes by fetching the current state of the destination system and compare the two based on 'externalId'.
 */
export class DiffAggregator implements Aggregator {
  private config: DiffAggregatorConfig = {};
  private adapter?: DestinationAdapter;
  private allowPruneAllEntities: boolean = false;

  public async initialize(
    config: DiffAggregatorConfig,
    adapters: AdapterPair<Adapter, DestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;

    this.allowPruneAllEntities = config.allowPruneAllEntities === 'true';
  }

  public async run(
    externalContent: ExternalContent,
  ): Promise<SyncableContents> {
    validateNonNull(this.adapter, 'Missing destination adapter');

    const exportResult = await this.adapter!.exportAllEntities();
    const storedItems = this.normalize(exportResult.importAction);
    const collectedItems = this.normalize(externalContent);

    this.resolveNameConflicts(
      collectedItems.categories,
      storedItems.categories,
    );
    this.resolveNameConflicts(collectedItems.labels, storedItems.labels);
    this.removeGeneratedContent(storedItems);

    const importAction = exportResult.importAction;
    return {
      categories: this.collectModifiedItems(
        collectedItems.categories,
        importAction.categories || [],
        this.normalizeCategory.bind(this),
      ),
      labels: this.collectModifiedItems(
        collectedItems.labels,
        importAction.labels || [],
        this.normalizeLabel.bind(this),
      ),
      documents: this.collectModifiedItems(
        collectedItems.documents,
        importAction.documents || [],
        this.normalizeDocument.bind(this),
      ),
    };
  }

  private normalize(content: ExternalContent): ExternalContent {
    return {
      categories: (content.categories || []).map(
        this.normalizeCategory.bind(this),
      ),
      labels: (content.labels || []).map(this.normalizeLabel.bind(this)),
      documents: (content.documents || []).map(
        this.normalizeDocument.bind(this),
      ),
    };
  }

  private collectModifiedItems<T extends ExternalIdentifiable>(
    collectedItems: T[],
    storedItems: T[],
    normalizer: (item: T) => T,
  ): ImportableContent<T> {
    const unprocessedStoredItems = [...storedItems];

    const result: ImportableContent<T> = {
      created: [],
      updated: [],
      deleted: [],
    };

    collectedItems.forEach((collectedItem: T): void => {
      const index = unprocessedStoredItems.findIndex(
        (currentItem) =>
          currentItem && currentItem.externalId === collectedItem.externalId,
      );
      if (index > -1) {
        const [storedItem] = unprocessedStoredItems.splice(index, 1);
        const normalizedStoredItem = normalizer(storedItem);

        this.copyProtectedContent(normalizedStoredItem, collectedItem);

        if (
          !_.isEqualWith(collectedItem, normalizedStoredItem, (c, s) =>
            this.isEqualCustomizer(c, s),
          )
        ) {
          result.updated.push(collectedItem);
        }
      } else {
        result.created.push(collectedItem);
      }
    });

    const prefix = this.config.externalIdPrefix;
    const sourceId = this.getSourceId();
    result.deleted = unprocessedStoredItems.filter((item: T) =>
      this.isFromSameSource(item, prefix, sourceId),
    );

    const storedItemsFromSameSource = storedItems.filter((item: T) =>
      this.isFromSameSource(item, prefix, sourceId),
    );
    if (
      result.deleted.length > 0 &&
      result.deleted.length === storedItemsFromSameSource.length &&
      result.created.length === 0 &&
      !this.allowPruneAllEntities
    ) {
      getLogger().error(
        'Prune all entities are not allowed. This protection can be disabled with ALLOW_PRUNE_ALL_ENTITIES=true in the configuration.',
      );
      throw new Error('Prune all entities are not allowed');
    }

    return result;
  }

  private normalizeDocument(document: Document): Document {
    const { externalId, published, draft } = document;

    return {
      id: null,
      externalId: externalId || null,
      published: published ? this.normalizeDocumentVersion(published) : null,
      draft: draft ? this.normalizeDocumentVersion(draft) : null,
    };
  }

  private normalizeDocumentVersion(
    documentVersion: DocumentVersion,
  ): DocumentVersion {
    const { title, alternatives, visible, category, labels, variations } =
      documentVersion;
    return {
      title: title ? title.trim() : title,
      alternatives: alternatives ?? null,
      visible,
      category: category ? this.normalizeCategoryReference(category) : null,
      labels:
        labels && labels.length
          ? labels.map(this.normalizeLabelReference)
          : null,
      variations: variations.map(this.normalizeVariation),
    };
  }

  private normalizeVariation(variation: Variation): Variation {
    const { name, priority, body } = variation;

    return {
      ...(name !== undefined && { name }),
      ...(priority !== undefined && { priority }),
      body,
    };
  }

  private normalizeCategory(category: Category): Category {
    const { externalId, name, parentCategory } = category;

    return {
      id: null,
      externalId: externalId || null,
      name,
      parentCategory: this.normalizeCategoryReference(parentCategory),
    };
  }

  private normalizeCategoryReference(
    categoryReference: CategoryReference | null,
  ): CategoryReference | null {
    if (!categoryReference) {
      return null;
    }

    return {
      id: null,
      name: categoryReference.name,
    };
  }

  private normalizeLabel(label: Label): Label {
    const { externalId, name, color } = label;

    return {
      id: null,
      externalId: externalId || null,
      name,
      color,
    };
  }

  private normalizeLabelReference(label: LabelReference): LabelReference {
    const { name } = label;

    return {
      id: null,
      name,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isEqualCustomizer(c: any, s: any): boolean | undefined {
    if (_.isString(c) && c === GeneratedValue.COLOR) {
      return true; // always accept stored value if collected value is generated
    } else if (_.isArray(c) && _.isArray(s) && c.length && _.isString(c[0])) {
      return _.isEqual(c.sort(), s.sort());
    }
  }

  private copyProtectedContent<T extends object>(
    source: T,
    destination: T,
  ): void {
    if (!this.config.protectedFields) {
      return;
    }
    const fieldPaths = this.config.protectedFields.split(',');
    fieldPaths.forEach((path) => {
      if (_.has(source, path)) {
        _.set(destination, path, _.get(source, path));
      }
    });
  }

  private removeGeneratedContent(content: ExternalContent): void {
    content.documents.forEach((document) => {
      [
        ...(document.published?.variations ?? []),
        ...(document.draft?.variations ?? []),
      ].forEach((variation) =>
        extractLinkBlocksFromVariation(variation).forEach((block) => {
          if (block.externalDocumentId) {
            block.hyperlink = undefined;
          }
        }),
      );
    });
  }

  private resolveNameConflicts<T extends NamedEntity>(
    collectedItems: T[],
    storedItems: T[],
  ): void {
    collectedItems.forEach((collectedItem: T): void => {
      if (this.hasNameConflict(collectedItem, storedItems)) {
        this.resolveNameConflict(collectedItem, storedItems);
      }
    });
  }

  private resolveNameConflict<T extends NamedEntity>(
    collectedItem: T,
    storedItems: T[],
  ): void {
    validateNonNull(
      this.config.nameConflictSuffix,
      `Name conflict found "${collectedItem.name}". Try to use "NAME_CONFLICT_SUFFIX" variable`,
    );

    collectedItem.name += this.config.nameConflictSuffix!;

    if (this.hasNameConflict(collectedItem, storedItems)) {
      throw Error(
        `Name conflict found with suffix "${collectedItem.name}". Try to use different "NAME_CONFLICT_SUFFIX" variable`,
      );
    }
  }

  private hasNameConflict<T extends NamedEntity>(
    collectedItem: T,
    storedItems: T[],
  ): boolean {
    return !!storedItems.find(
      (currentItem) =>
        currentItem &&
        currentItem.name === collectedItem.name &&
        currentItem.externalId !== collectedItem.externalId,
    );
  }

  private isFromSameSource(
    item: ExternalIdentifiable,
    prefix: string | undefined,
    sourceId: string | null,
  ): boolean {
    if (sourceId) {
      return this.isSourceIdMatch(item, sourceId);
    }

    if (prefix) {
      return this.isExternalIdPrefixMatch(item, prefix);
    }

    return this.hasExternalId(item);
  }

  private isSourceIdMatch(
    item: ExternalIdentifiable,
    sourceId: string | null,
  ): boolean {
    return item.sourceId === sourceId;
  }

  private isExternalIdPrefixMatch(
    item: ExternalIdentifiable,
    prefix: string,
  ): boolean {
    return !!item?.externalId && item.externalId.startsWith(prefix);
  }

  private hasExternalId(item: ExternalIdentifiable): boolean {
    return !!item?.externalId;
  }

  private getSourceId(): string | null {
    return this.config.genesysSourceId || null;
  }
}
