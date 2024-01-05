import { Aggregator } from './aggregator.js';
import { ExternalContent } from '../model/external-content.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import {
  ImportableContent,
  ImportableContents,
} from '../model/importable-contents.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import _, { get, has, set } from 'lodash';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import {
  Document,
  DocumentVersion,
  Variation,
} from '../model/import-export-model.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { CategoryReference } from '../model/category-reference.js';
import { LabelReference } from '../model/label-reference.js';
import { GeneratedValue } from '../utils/generated-value.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { DiffAggregatorConfig } from './diff-aggregator-config.js';

/**
 * The DiffAggregator transforms the ExternalContent into ImportableContents,
 * and filters out entities that have not been changed since last run.
 * It detects changes by fetching the current state of the destination system and compare the two based on 'externalId'.
 */
export class DiffAggregator implements Aggregator {
  private config: DiffAggregatorConfig = {};
  private adapter?: DestinationAdapter;

  public async initialize(
    config: DiffAggregatorConfig,
    adapters: AdapterPair<Adapter, DestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;
  }

  public async run(
    externalContent: ExternalContent,
  ): Promise<ImportableContents> {
    validateNonNull(this.adapter, 'Missing destination adapter');

    const exportResult = await this.adapter!.exportAllEntities();

    return {
      categories: this.collectModifiedItems(
        externalContent.categories,
        exportResult.categories || [],
        (category) => this.normalizeCategory(category),
      ),
      labels: this.collectModifiedItems(
        externalContent.labels,
        exportResult.labels || [],
        (label) => this.normalizeLabel(label),
      ),
      documents: this.collectModifiedItems(
        externalContent.documents,
        exportResult.documents || [],
        (document: Document) => this.normalizeDocument(document),
      ),
    };
  }

  private collectModifiedItems<T extends ExternalIdentifiable>(
    collectedItems: T[],
    storedItems: T[],
    normalizer: (item: T) => T,
  ): ImportableContent<T> {
    const unprocessedStoredItems = [...storedItems.map(normalizer)];

    const result: ImportableContent<T> = {
      created: [],
      updated: [],
      deleted: [],
    };

    collectedItems.map(normalizer).forEach((collectedItem: T): void => {
      if (!collectedItem) {
        return;
      }

      const index = unprocessedStoredItems.findIndex(
        (currentItem) =>
          currentItem && currentItem.externalId === collectedItem.externalId,
      );
      if (index > -1) {
        const storedItem = normalizer(unprocessedStoredItems[index]);
        unprocessedStoredItems.splice(index, 1);

        this.copyProtectedContent(storedItem, collectedItem);

        if (
          !_.isEqualWith(collectedItem, storedItem, (c, s) =>
            this.isEqualCustomizer(c, s),
          )
        ) {
          result.updated.push(collectedItem);
        }
      } else {
        result.created.push(collectedItem);
      }
    });

    result.deleted = unprocessedStoredItems
      .filter((item: T) => item.externalId)
      .map((item) => storedItems.find((c) => c.externalId === item.externalId))
      .filter((item): item is T => !!item);

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
      title,
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
    const { body } = variation;

    return {
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
      if (has(source, path)) {
        set(destination, path, get(source, path));
      }
    });
  }
}
