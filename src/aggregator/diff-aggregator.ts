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
import { Document, DocumentVersion, Variation } from '../model/document.js';
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
import { ConfigurerError } from './errors/configurer-error.js';
import { Identifiable } from '../model/identifiable.js';

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
    const {
      categories: storedCategories = [],
      labels: storedLabels = [],
      documents: storedDocuments = [],
    } = this.removeGeneratedContent(exportResult.importAction);
    const {
      categories: collectedCategories = [],
      labels: collectedLabels = [],
      documents: collectedDocuments = [],
    } = externalContent;

    this.resolveNameConflicts(collectedCategories, storedCategories);
    this.resolveNameConflicts(collectedLabels, storedLabels);

    const categories = this.collectModifiedItems(
      collectedCategories,
      storedCategories,
      this.normalizeCategory.bind(this),
    );

    const labels = this.collectModifiedItems(
      collectedLabels,
      storedLabels,
      this.normalizeLabel.bind(this),
    );

    const documents = this.collectModifiedItems(
      collectedDocuments,
      storedDocuments,
      (doc) =>
        this.normalizeDocument(
          doc,
          [...collectedCategories, ...storedCategories],
          [...collectedLabels, ...storedLabels],
        ),
    );

    return {
      categories,
      labels,
      documents,
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
      const normalizedCollectedItem = normalizer(collectedItem);
      const index = unprocessedStoredItems.findIndex(
        (currentItem) =>
          currentItem &&
          currentItem.externalId === normalizedCollectedItem.externalId,
      );
      if (index > -1) {
        const [storedItem] = unprocessedStoredItems.splice(index, 1);
        const normalizedStoredItem = normalizer(storedItem);

        this.copyProtectedContent(
          normalizedStoredItem,
          normalizedCollectedItem,
        );

        if (
          !_.isEqualWith(
            normalizedCollectedItem,
            normalizedStoredItem,
            (c, s) => this.isEqualCustomizer(c, s),
          )
        ) {
          result.updated.push(normalizedCollectedItem);
        }
      } else {
        result.created.push(normalizedCollectedItem);
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
      throw new ConfigurerError('Prune all entities are not allowed', {
        cause: 'prune.all.entities',
      });
    }

    return result;
  }

  private normalizeDocument(
    document: Document,
    allCategories: Category[],
    allLabels: Label[],
  ): Document {
    const { externalId, externalUrl, published, draft } = document;

    return {
      id: null,
      externalId: externalId || null,
      externalUrl: externalUrl || null,
      published: published
        ? this.normalizeDocumentVersion(published, allCategories, allLabels)
        : null,
      draft: draft
        ? this.normalizeDocumentVersion(draft, allCategories, allLabels)
        : null,
    };
  }

  private normalizeDocumentVersion(
    documentVersion: DocumentVersion,
    allCategories: Category[],
    allLabels: Label[],
  ): DocumentVersion {
    const { title, alternatives, visible, category, labels, variations } =
      documentVersion;
    return {
      title: title ? title.trim() : title,
      alternatives: alternatives ?? null,
      visible,
      category: category
        ? this.normalizeCategoryReference(category, allCategories)
        : null,
      labels:
        labels && labels.length
          ? labels.map((l) => this.normalizeLabelReference(l, allLabels))
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
      parentCategory: this.normalizeCategoryReference(parentCategory, []),
    };
  }

  private normalizeCategoryReference(
    categoryReference: CategoryReference | null,
    allCategories: Category[],
  ): CategoryReference | null {
    if (!categoryReference) {
      return null;
    }

    const category = allCategories
      .filter(
        (c) => c.externalId === this.getPrefixedExternalId(categoryReference),
      )
      .shift();

    if (!category) {
      return {
        id: null,
        name: categoryReference.name,
      };
    }

    return {
      id: null,
      name: category.name,
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

  private normalizeLabelReference(
    labelReference: LabelReference,
    allLabels: Label[],
  ): LabelReference {
    const label = allLabels
      .filter(
        (c) => c.externalId === this.getPrefixedExternalId(labelReference),
      )
      .shift();

    if (!label) {
      return {
        id: null,
        name: labelReference.name,
      };
    }

    return {
      id: null,
      name: label.name,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isEqualCustomizer(c: any, s: any): boolean | undefined {
    if (_.isString(c) && c === GeneratedValue.COLOR) {
      return true; // always accept stored value if collected value is generated
    }

    if (_.isArray(c) && _.isArray(s) && c.length && _.isString(c[0])) {
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

  private removeGeneratedContent(content: ExternalContent): ExternalContent {
    content.documents?.forEach((document) => {
      [
        ...(document.published?.variations ?? []),
        ...(document.draft?.variations ?? []),
      ].forEach((variation) =>
        extractLinkBlocksFromVariation(variation).forEach((block) => {
          if (block.externalDocumentId) {
            delete block.hyperlink;
          }
        }),
      );
    });

    return content;
  }

  private resolveNameConflicts<T extends NamedEntity>(
    collectedItems: T[],
    storedItems: T[],
  ): void {
    const processedItems = [...storedItems];
    collectedItems.forEach((collectedItem: T): void => {
      if (this.hasNameConflict(collectedItem, processedItems)) {
        this.resolveNameConflict(collectedItem, processedItems);
      }
      processedItems.push(collectedItem);
    });
  }

  private resolveNameConflict<T extends NamedEntity>(
    collectedItem: T,
    processedItems: T[],
  ): void {
    validateNonNull(
      this.config.nameConflictSuffix,
      `Name conflict found "${collectedItem.name}". Try to use "NAME_CONFLICT_SUFFIX" variable`,
    );

    collectedItem.name += this.config.nameConflictSuffix!;

    if (this.hasNameConflict(collectedItem, processedItems)) {
      this.resolveNameConflict(collectedItem, processedItems);
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

  private getPrefixedExternalId(item: Identifiable) {
    return (this.config.externalIdPrefix || '') + item.id;
  }
}
