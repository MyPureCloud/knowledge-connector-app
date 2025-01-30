import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DiffUploader } from './diff-uploader.js';
import {
  GenesysDestinationAdapter,
  GenesysDestinationConfig,
} from '../genesys';
import { PipeContext } from '../pipe/pipe-context.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import {
  ExternalIdentifiable,
  SyncableContents,
  SyncDataResponse,
  SyncModel,
} from '../model';
import { MockInstance } from 'jest-mock';
import { ConfigurerError } from '../aggregator/errors/configurer-error.js';

jest.mock('../utils/package-version.js');
jest.mock('../genesys/genesys-destination-adapter.js');

describe('DiffUploader', () => {
  const SOURCE_ID = 'source-id';
  const OTHER_SOURCE_ID = 'other-source-id';
  const THIRD_SOURCE_ID = 'third-source-id';
  const EXTERNAL_ID_PREFIX = 'some-external-id-prefix-';
  const OTHER_EXTERNAL_ID_PREFIX = 'other-external-id-prefix-';
  const THIRD_EXTERNAL_ID_PREFIX = 'third-external-id-prefix-';

  let uploader: DiffUploader;
  let config: GenesysDestinationConfig;
  let context: PipeContext;
  let sourceAdapter: SourceAdapter<unknown, unknown, unknown>;
  let destinationAdapter: GenesysDestinationAdapter;
  let syncData: MockInstance<(data: SyncModel) => Promise<SyncDataResponse>>;

  beforeEach(async () => {
    config = {
      genesysKnowledgeBaseId: 'kb-id',
    };
    context = {
      storedContent: {
        categories: [],
        labels: [],
        documents: [],
      },
    } as unknown as PipeContext;
    sourceAdapter = {} as SourceAdapter<unknown, unknown, unknown>;
    destinationAdapter = new GenesysDestinationAdapter();
    syncData = destinationAdapter.syncData as unknown as MockInstance<
      (data: SyncModel) => Promise<SyncDataResponse>
    >;

    uploader = new DiffUploader();
  });

  describe('when syncing from multiple sources', () => {
    describe('when no externalIdPrefix and no sourceId given', () => {
      beforeEach(async () => {
        await initializeUploader({});
      });

      it('should keep all entities in deleted section', async () => {
        const content = generateContent(EXTERNAL_ID_PREFIX, null);

        await uploader.run(content);

        verifySyncData(8);
      });
    });

    describe('when externalIdPrefix given', () => {
      beforeEach(async () => {
        await initializeUploader({
          externalIdPrefix: EXTERNAL_ID_PREFIX,
        });
      });

      it('should remove entities with other externalIdPrefix from deleted section', async () => {
        const content = generateContent(EXTERNAL_ID_PREFIX, null);

        await uploader.run(content);

        verifySyncData(4);
      });
    });

    describe('when genesysSourceId given', () => {
      beforeEach(async () => {
        await initializeUploader({
          genesysSourceId: SOURCE_ID,
        });
      });

      it('should remove entities with other sourceId from deleted section', async () => {
        const content = generateContent(null, SOURCE_ID);

        await uploader.run(content);

        verifySyncData(4);
      });
    });
  });

  describe('when source returns no items', () => {
    let content: SyncableContents;
    beforeEach(async () => {
      content = generateContent(null, null);

      context.storedContent!.categories.push(...content.categories.deleted);
      context.storedContent!.labels.push(...content.labels.deleted);
      context.storedContent!.documents.push(...content.documents.deleted);
    });

    describe('when prune all entities not allowed', () => {
      beforeEach(async () => {
        await initializeUploader({});
      });

      it('should throw error', () => {
        expect(() => uploader.run(content)).rejects.toThrow(ConfigurerError);
      });

      describe('when stored content has more items than in the deleted section', () => {
        it('should not throw', async () => {
          context.storedContent!.categories.push(generateItem(null, null));
          context.storedContent!.labels.push(generateItem(null, null));
          context.storedContent!.documents.push(generateItem(null, null));

          await uploader.run(content);

          verifySyncData(8);
        });
      });
    });

    describe('when prune all entities allowed', () => {
      beforeEach(async () => {
        await initializeUploader({
          allowPruneAllEntities: 'true',
        });
      });

      it('should delete all entities', async () => {
        await uploader.run(content);

        verifySyncData(8);
      });
    });
  });

  function generateContent(
    externalIdPrefix: string | null,
    sourceId: string | null,
  ): SyncableContents {
    return {
      categories: {
        created: [],
        updated: [],
        deleted: [
          generateItem(externalIdPrefix, sourceId),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
          generateItem(externalIdPrefix, sourceId),
          generateItem(THIRD_EXTERNAL_ID_PREFIX, THIRD_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
        ],
      },
      labels: {
        created: [],
        updated: [],
        deleted: [
          generateItem(externalIdPrefix, sourceId),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
          generateItem(externalIdPrefix, sourceId),
          generateItem(THIRD_EXTERNAL_ID_PREFIX, THIRD_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
        ],
      },
      documents: {
        created: [],
        updated: [],
        deleted: [
          generateItem(externalIdPrefix, sourceId),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
          generateItem(externalIdPrefix, sourceId),
          generateItem(THIRD_EXTERNAL_ID_PREFIX, THIRD_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(OTHER_EXTERNAL_ID_PREFIX, OTHER_SOURCE_ID),
          generateItem(externalIdPrefix, sourceId),
        ],
      },
    };
  }

  function generateItem<T extends ExternalIdentifiable>(
    externalIdPrefix: string | null,
    sourceId: string | null,
  ): T {
    const id = Math.random().toString();
    return {
      id,
      externalId: (externalIdPrefix ?? '') + id,
      sourceId: sourceId,
    } as T;
  }

  async function initializeUploader(
    override: GenesysDestinationConfig,
  ): Promise<void> {
    await uploader.initialize(
      {
        ...config,
        ...override,
      },
      { sourceAdapter, destinationAdapter },
      context,
    );
  }

  function verifySyncData(length: number): void {
    expect(destinationAdapter.syncData).toHaveBeenCalledTimes(1);
    const actual: SyncModel = syncData.mock.calls[0][0];
    expect(actual.deleteAction.categories).toHaveLength(length);
    expect(actual.deleteAction.labels).toHaveLength(length);
    expect(actual.deleteAction.documents).toHaveLength(length);
  }
});
