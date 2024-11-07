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
import { Identifiable } from '../model/identifiable.js';
import { PipeContext } from '../pipe/pipe-context.js';

/**
 * The DiffAggregator transforms the ExternalContent into ImportableContents,
 * and filters out entities that have not been changed since last run.
 * It detects changes by fetching the current state of the destination system and compare the two based on 'externalId'.
 */
export class DiffAggregator implements Aggregator {
  private adapter?: DestinationAdapter;
  private context?: PipeContext;
  private protectedFields: string[] = [];
  private externalIdPrefix: string = '';

  public async initialize(
    config: DiffAggregatorConfig,
    adapters: AdapterPair<Adapter, DestinationAdapter>,
    context: PipeContext,
  ): Promise<void> {
    this.adapter = adapters.destinationAdapter;
    this.context = context;

    this.protectedFields = (config.protectedFields || '').split(',');
  }

  public async runOnCategory(content: Category): Promise<void> {
    const { categories: storedCategories = [] } =
      this.context!.storedContent || {};

    this.collectModifiedItem(
      content,
      storedCategories,
      this.normalizeCategory.bind(this),
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
    const {
      categories: storedCategories = [],
      labels: storedLabels = [],
      documents: storedDocuments = [],
    } = this.context!.storedContent || {};

    const {
      categories: collectedCategories = [],
      labels: collectedLabels = [],
    } = this.context!.pipe.processedItems || {};

    this.collectModifiedItem(
      content,
      storedDocuments,
      (doc) =>
        this.normalizeDocument(
          doc,
          [...collectedCategories, ...storedCategories],
          [...collectedLabels, ...storedLabels],
        ),
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
        currentItem.externalId === normalizedCollectedItem.externalId,
    );
    if (index > -1) {
      const [storedItem] = unprocessedStoredItems.splice(index, 1);
      const normalizedStoredItem = normalizer(storedItem);

      this.copyProtectedContent(normalizedStoredItem, normalizedCollectedItem);

      if (
        !_.isEqualWith(normalizedCollectedItem, normalizedStoredItem, (c, s) =>
          this.isEqualCustomizer(c, s),
        )
      ) {
        result.updated.push(normalizedCollectedItem);
      }
      result.deleted = result.deleted.filter(
        (i: T) => i.externalId !== normalizedCollectedItem.externalId,
      );
    } else {
      result.created.push(normalizedCollectedItem);
    }
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
    this.protectedFields.forEach((path) => {
      if (_.has(source, path)) {
        _.set(destination, path, _.get(source, path));
      }
    });
  }

  private getPrefixedExternalId(item: Identifiable): string {
    return this.externalIdPrefix + item.id;
  }
}
