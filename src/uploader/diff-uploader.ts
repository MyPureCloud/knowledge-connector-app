import { Uploader } from './uploader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import {
  ImportableContent,
  SyncableContents,
} from '../model/syncable-contents.js';
import { SyncModel } from '../model/sync-export-model.js';
import { GenesysDestinationConfig } from '../genesys/model/genesys-destination-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { generatedValueResolver } from './generated-value-resolver.js';
import { getLogger } from '../utils/logger.js';
import { Document, ExternalContent, ExternalIdentifiable } from '../model';
import { ConfigurerError } from '../aggregator/errors/configurer-error.js';
import {
  isFromSameSource,
  removeExternalIdPrefix,
} from '../utils/source-matcher.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { FailedItems } from '../model/failed-items.js';
import { SourceAdapter } from '../adapter/source-adapter.js';

/**
 * DiffUploader collects all the new and changed entities into a JSON format and uploads it to Genesys Knowledge's import API
 */
export class DiffUploader implements Uploader {
  private config?: GenesysDestinationConfig;
  private adapter?: GenesysDestinationAdapter;
  private sourceAdapter?: SourceAdapter<unknown, unknown, unknown>;
  private context?: PipeContext;
  private externalIdPrefix: string | null = null;
  private sourceId: string | null = null;
  private allowPruneAllEntities: boolean = true;

  public async initialize(
    config: GenesysDestinationConfig,
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      GenesysDestinationAdapter
    >,
    context: PipeContext,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.destinationAdapter;
    this.sourceAdapter = adapters.sourceAdapter;
    this.context = context;

    this.externalIdPrefix = this.config.externalIdPrefix ?? null;
    this.sourceId = this.config.genesysSourceId ?? null;
    this.allowPruneAllEntities = this.config.allowPruneAllEntities === 'true';
  }

  public async run(
    importableContents: SyncableContents,
    failedItems: FailedItems,
  ): Promise<void> {
    validateNonNull(
      this.config?.genesysKnowledgeBaseId,
      'Missing Genesys Knowledge Base Id',
    );
    validateNonNull(this.adapter, 'Missing destination adapter');

    this.removeItemsNotFromSameSource(importableContents.categories);
    this.removeItemsNotFromSameSource(importableContents.labels);
    this.removeItemsNotFromSameSource(importableContents.documents);

    try {
      await this.logDeletedDocuments(importableContents.documents.deleted);
    } catch (error) {
      getLogger().error('Error verifying document deletion', error as Error);
    }

    this.verifyNotToDeleteEverything(
      importableContents.categories,
      this.context?.storedContent?.categories || [],
    );
    this.verifyNotToDeleteEverything(
      importableContents.labels,
      this.context?.storedContent?.labels || [],
    );
    this.verifyNotToDeleteEverything(
      importableContents.documents,
      this.context?.storedContent?.documents || [],
    );
    const data: SyncModel = this.constructSyncModel(
      importableContents,
      failedItems,
    );

    const processedItems = this.context?.pipe?.processedItems ||
      {
        categories: [],
        labels: [],
        documents: [],
      };

    this.logStatistics(importableContents, processedItems);

    if (this.shouldUpload(data)) {
      await this.upload(data);
    } else {
      getLogger().info('There is no change to upload.');
    }
  }

  protected constructSyncModel(
    importableContents: SyncableContents,
    failedItems: FailedItems,
  ): SyncModel {
    return {
      version: 3,
      importAction: {
        knowledgeBase: {
          id: this.config!.genesysKnowledgeBaseId!,
        },
        categories: [
          ...importableContents.categories.created,
          ...importableContents.categories.updated,
        ]
          .map(generatedValueResolver)
          .concat(failedItems.categories),
        labels: [
          ...importableContents.labels.created,
          ...importableContents.labels.updated,
        ]
          .map(generatedValueResolver)
          .concat(failedItems.labels),
        documents: [
          ...importableContents.documents.created,
          ...importableContents.documents.updated,
        ]
          .map(generatedValueResolver)
          .concat(failedItems.documents),
      },
      deleteAction: {
        documents: importableContents.documents.deleted
          .filter((document) => document.id !== null)
          .map((document) => document.id!),
        categories: importableContents.categories.deleted
          .filter((category) => category.id !== null)
          .map((category) => category.id!),
        labels: importableContents.labels.deleted
          .filter((label) => label.id !== null)
          .map((label) => label.id!),
      },
    };
  }

  protected logStatistics(importableContents: SyncableContents, processedItems: ExternalContent): void {
    const processedCategories = processedItems.categories.length;
    const processedLabels = processedItems.labels.length;
    const processedDocuments = processedItems.documents.length;
    getLogger().info(
      'Categories to create: ' + importableContents.categories.created.length + ' out of: ' + processedCategories,
    );
    getLogger().info(
      'Categories to update: ' + importableContents.categories.updated.length + ' out of: ' + processedCategories,
    );
    getLogger().info(
      'Categories to delete: ' + importableContents.categories.deleted.length + ' out of: ' + processedCategories,
    );
    getLogger().info(
      'Labels to create: ' + importableContents.labels.created.length + ' out of: ' + processedLabels,
    );
    getLogger().info(
      'Labels to update: ' + importableContents.labels.updated.length + ' out of: ' + processedLabels,
    );
    getLogger().info(
      'Labels to delete: ' + importableContents.labels.deleted.length + ' out of: ' + processedLabels,
    );
    getLogger().info(
      'Documents to create: ' + importableContents.documents.created.length + ' out of: ' + processedDocuments,
    );
    getLogger().info(
      'Documents to update: ' + importableContents.documents.updated.length + ' out of: ' + processedDocuments,
    );
    getLogger().info(
      'Documents to delete: ' + importableContents.documents.deleted.length + ' out of: ' + processedDocuments,
    );
  }

  protected async upload(data: SyncModel): Promise<void> {
    getLogger().info('Uploading data...');

    const response = await this.adapter!.syncData(data);

    getLogger().info('Upload finished');
    getLogger().info('Sync job id: ' + response.id);
    getLogger().info('Sync job status: ' + response.status);

    if (response.failedEntitiesURL) {
      getLogger().info('Errors during import: ' + response.failedEntitiesURL);
    }
  }

  protected shouldUpload(data: SyncModel): boolean {
    return !!(
      data.importAction.labels.length ||
      data.importAction.categories.length ||
      data.importAction.documents.length ||
      data.deleteAction.categories.length ||
      data.deleteAction.labels.length ||
      data.deleteAction.documents.length
    );
  }

  private verifyNotToDeleteEverything<T extends ExternalIdentifiable>(
    content: ImportableContent<T>,
    storedItems: T[],
  ): void {
    const storedItemsFromSameSource = storedItems
      .filter((item: T) =>
        isFromSameSource(item, this.sourceId, this.externalIdPrefix),
      )
      .map((i) => i.externalId);
    if (
      !this.allowPruneAllEntities &&
      content.created.length === 0 &&
      content.deleted.length > 0 &&
      content.deleted.length === storedItemsFromSameSource.length &&
      content.deleted
        .map((i) => i.externalId)
        .every((externalId) => storedItemsFromSameSource.includes(externalId))
    ) {
      getLogger().error(
        'Prune all entities are not allowed. This protection can be disabled with ALLOW_PRUNE_ALL_ENTITIES=true in the configuration.',
      );
      throw new ConfigurerError('Prune all entities are not allowed', {
        cause: 'prune.all.entities',
      });
    }
  }

  private removeItemsNotFromSameSource<T extends ExternalIdentifiable>(
    content: ImportableContent<T>,
  ): void {
    content.deleted = content.deleted.filter((item: T) =>
      isFromSameSource(item, this.sourceId, this.externalIdPrefix),
    );
  }

  private async logDeletedDocuments(
    documents: Document[] = [],
  ): Promise<void> {
    getLogger().info(`Verify ${documents.length} documents before deleting`);
    for (const document of documents) {
      await this.logDeletedDocumentsState(document);
    }
  }

  private async logDeletedDocumentsState(document: Document): Promise<void> {
    await this.sourceAdapter!.constructDocumentLink(
      removeExternalIdPrefix(document.externalId!, this.externalIdPrefix),
    );
  }
}
