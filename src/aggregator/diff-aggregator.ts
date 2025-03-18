import { Aggregator } from './aggregator.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContent } from '../model/syncable-contents.js';
import _ from 'lodash';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import { Document, DocumentVersion, Variation } from '../model/document.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { CategoryReference } from '../model/category-reference.js';
import { LabelReference } from '../model/label-reference.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { DiffAggregatorConfig } from './diff-aggregator-config.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { MissingReferenceError } from '../utils/errors/missing-reference-error.js';
import { EntityType } from '../model/entity-type.js';
import { CompareMode } from '../utils/compare-mode.js';

const HELPER_PROPERTIES = ['externalIdAlternatives'];

/**
 * The DiffAggregator transforms the ExternalContent into ImportableContents,
 * and filters out entities that have not been changed since last run.
 * It detects changes by fetching the current state of the destination system and compare the two based on 'externalId'.
 */
export class DiffAggregator implements Aggregator {
  private context?: PipeContext;
  private config?: DiffAggregatorConfig;
  private protectedFields: string[] = [];
  private externalIdPrefix: string = '';
  private compareMode?: CompareMode;

  public async initialize(
    config: DiffAggregatorConfig,
    _adapters: AdapterPair<Adapter, DestinationAdapter>,
    context: PipeContext,
  ): Promise<void> {
    this.context = context;

    this.protectedFields = (config.protectedFields ?? '').split(',');
    this.externalIdPrefix = config.externalIdPrefix ?? '';
    this.compareMode = config.compareMode ?? CompareMode.MODIFICATION_DATE;
  }

  public async runOnCategory(content: Category): Promise<void> {
    const { categories: storedCategories = [] } =
      this.context!.storedContent || {};

    this.collectModifiedItem(
      content,
      storedCategories,
      (category: Category) => this.normalizeCategory(category),
      this.context!.syncableContents.categories,
    );
  }

  public async runOnLabel(content: Label): Promise<void> {
    const { labels: storedLabels = [] } = this.context!.storedContent || {};

    this.collectModifiedItem(
      content,
      storedLabels,
      this.normalizeLabel.bind(this),
      this.context!.syncableContents.labels,
    );
  }

  public async runOnDocument(content: Document): Promise<void> {
    const { documents: storedDocuments = [] } =
      this.context!.storedContent || {};

    this.collectModifiedItem(
      content,
      storedDocuments,
      (doc) => this.normalizeDocument(doc),
      this.context!.syncableContents.documents,
    );
  }

  private collectModifiedItem<T extends ExternalIdentifiable>(
    collectedItem: T,
    storedItems: T[],
    normalizer: (item: T) => T,
    result: ImportableContent<T>,
  ): void {
    const unprocessedStoredItems = [...storedItems];

    const normalizedCollectedItem = normalizer(collectedItem);
    const index = unprocessedStoredItems.findIndex(
      (currentItem) =>
        currentItem &&
        this.isSameByExternalId(normalizedCollectedItem, currentItem),
    );
    if (index > -1) {
      const [storedItem] = unprocessedStoredItems.splice(index, 1);
      const normalizedStoredItem = normalizer(storedItem);

      this.copyProtectedContent(normalizedStoredItem, normalizedCollectedItem);

      if (!this.isEqual(normalizedCollectedItem, normalizedStoredItem)) {
        result.updated.push(normalizedCollectedItem);
      }
      result.deleted = result.deleted.filter(
        (i: T) => !this.isSameByExternalId(normalizedCollectedItem, i),
      );
    } else {
      result.created.push(normalizedCollectedItem);
    }
  }

  private isEqual<T extends ExternalIdentifiable>(normalizedCollectedItem: T, normalizedStoredItem: T): boolean {
    if (this.compareMode === CompareMode.MODIFICATION_DATE &&
      (normalizedCollectedItem.externalVersionId || normalizedStoredItem.externalVersionId)) {
      return normalizedCollectedItem.externalVersionId === normalizedStoredItem.externalVersionId;
    }

    if (this.compareMode === CompareMode.NONE) { return false; }

    return _.isEqualWith(normalizedCollectedItem, normalizedStoredItem, (c, s) =>
      this.isEqualCustomizer(c, s),
    )
  }

  private normalizeDocument(document: Document): Document {
    const {
      externalId,
      externalIdAlternatives,
      externalUrl,
      published,
      draft,
      externalVersionId
    } = document;

    return {
      id: null,
      externalId: externalId || null,
      externalIdAlternatives: externalIdAlternatives || null,
      externalUrl: externalUrl || null,
      published: published ? this.normalizeDocumentVersion(published) : null,
      draft: draft ? this.normalizeDocumentVersion(draft) : null,
      externalVersionId: externalVersionId || null
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
      labels: labels?.length
        ? labels.map((l) => this.normalizeLabelReference(l)).filter((l) => !!l)
        : null,
      variations: variations?.length
        ? variations.map(this.normalizeVariation)
        : null,
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
      externalId: externalId ?? null,
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

    if (!categoryReference.externalId && categoryReference.name) {
      const { name } = this.getFinalVersionByName(
        categoryReference.name,
        this.context!.categoryLookupTable,
      );

      return { id: null, externalId: null, name };
    }

    const { name } = this.getFinalVersion(
      categoryReference.externalId!,
      this.context!.categoryLookupTable,
      EntityType.CATEGORY,
    );

    return { id: null, externalId: null, name };
  }

  private normalizeLabel(label: Label): Label {
    const { externalId, name, color } = label;

    return {
      id: null,
      externalId: externalId ?? null,
      name,
      color,
    };
  }

  private normalizeLabelReference(
    labelReference: LabelReference,
  ): LabelReference | null {
    if (!labelReference) {
      return null;
    }

    if (!labelReference.externalId && labelReference.name) {
      const { name } = this.getFinalVersionByName(
        labelReference.name,
        this.context!.labelLookupTable,
      );

      return { id: null, externalId: null, name };
    }

    const { name } = this.getFinalVersion(
      labelReference.externalId!,
      this.context!.labelLookupTable,
      EntityType.LABEL,
    );

    return {
      id: null,
      externalId: null,
      name,
    };
  }

  private isEqualCustomizer(c: unknown, s: unknown): boolean | undefined {
    if (_.isString(c) && c === GeneratedValue.COLOR) {
      return true; // always accept stored value if collected value is generated
    }

    if (_.isArray(c) && _.isArray(s) && c.length && _.isString(c[0])) {
      return _.isEqual(c.sort(), s.sort());
    }

    if (this.hasHelperProperty(c)) {
      return _.isEqualWith(
        this.objectWithoutHelperProperties(c as object),
        this.objectWithoutHelperProperties(s as object),
        (c, s) => this.isEqualCustomizer(c, s),
      );
    }
  }

  private copyProtectedContent<T extends object>(
    source: T,
    destination: T,
  ): void {
    this.protectedFields.forEach((path) => {
      if (_.has(source, path)) {
        _.set(destination, path, _.get(source, path));
      }
    });
  }

  private isSameByExternalId(
    collectedItem: ExternalIdentifiable,
    storedItem: ExternalIdentifiable,
  ): boolean {
    return [
      collectedItem.externalId,
      ...(collectedItem.externalIdAlternatives?.length
        ? this.getPrefixedAlternativeIds(collectedItem.externalIdAlternatives)
        : []),
    ]
      .filter((id) => !!id)
      .includes(storedItem.externalId);
  }

  private getPrefixedId(id: string | null | undefined): string | null {
    if (!id) {
      return null;
    }
    return this.externalIdPrefix + id;
  }

  private getPrefixedAlternativeIds(ids: string[]): string[] {
    return ids.filter((id) => !!id).map((id) => this.getPrefixedId(id)!);
  }

  private hasHelperProperty(a: unknown): boolean {
    return (
      _.isPlainObject(a) &&
      _.intersection(Object.keys(a as object), HELPER_PROPERTIES).length > 0
    );
  }

  private objectWithoutHelperProperties(obj: object): object {
    return _.omit(obj, HELPER_PROPERTIES);
  }

  private getExternalIdWithoutPrefix(externalId: string): string {
    if (externalId.startsWith(this.externalIdPrefix)) {
      return externalId.substring(this.externalIdPrefix.length);
    }
    return externalId;
  }

  private getFinalVersion<R extends CategoryReference | LabelReference>(
    externalId: string,
    lookupTable: Record<string, R>,
    entityType: EntityType,
  ): R {
    const item = lookupTable[externalId];

    if (!item) {
      throw new MissingReferenceError(entityType, externalId);
    }

    return item;
  }

  private getFinalVersionByName<R extends CategoryReference | LabelReference>(
    name: string,
    lookupTable: Record<string, R>,
  ): R {
    const item = Object.values(lookupTable).find((item) => item.name === name);

    if (!item) {
      return {
        id: null,
        externalId: null,
        name,
      } as R;
    }

    return item;
  }
}
