import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DiffAggregator } from './diff-aggregator.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../tests/utils/entity-generators.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { ImportableContent } from '../model/syncable-contents.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import { PipeContext } from '../pipe/pipe-context.js';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('DiffAggregator', () => {
  const ALTERNATIVE_EXTERNAL_ID = 'alternative-external-id';

  let sourceAdapter: SourceAdapter<Category, Label, Document>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<Adapter, DestinationAdapter>;
  let aggregator: DiffAggregator;
  let context: PipeContext;

  describe('run', () => {
    beforeEach(async () => {
      sourceAdapter = {} as typeof sourceAdapter;
      destinationAdapter = new GenesysDestinationAdapter();
      adapters = {
        sourceAdapter,
        destinationAdapter,
      };
      aggregator = new DiffAggregator();
      context = buildContext();

      await aggregator.initialize(
        { protectedFields: 'published.alternatives' },
        adapters,
        context,
      );
    });

    describe('when export from destination is empty', () => {
      beforeEach(() => {
        prepareStoredContent([], [], []);
      });

      it('should collect all entities to the created group', async () => {
        await aggregator.runOnCategory(generateNormalizedCategory('-1'));
        await aggregator.runOnCategory(generateNormalizedCategory('-2'));
        await aggregator.runOnCategory(generateNormalizedCategory('-3'));
        await aggregator.runOnLabel(generateNormalizedLabel('-1'));
        await aggregator.runOnLabel(generateNormalizedLabel('-2'));
        await aggregator.runOnLabel(generateNormalizedLabel('-3'));
        await aggregator.runOnDocument(generateNormalizedDocument('-1'));
        await aggregator.runOnDocument(generateNormalizedDocument('-2'));
        await aggregator.runOnDocument(generateNormalizedDocument('-3'));

        verifyGroups(context.syncableContents.categories, 3, 0, 0);
        verifyGroups(context.syncableContents.labels, 3, 0, 0);
        verifyGroups(context.syncableContents.documents, 3, 0, 0);
      });
    });

    describe('when export from destination is not empty', () => {
      beforeEach(() => {
        prepareStoredContent(
          [
            generateNormalizedCategory('-1', 'category-id-1'),
            generateNormalizedCategory('-2', 'category-id-2'),
          ],
          [
            generateNormalizedLabel('-1', 'label-id-1'),
            generateNormalizedLabel('-2', 'label-id-2'),
          ],
          [
            generateNormalizedDocument('-1', 'document-id-1'),
            generateNormalizedDocument('-4', 'document-id-4'),
          ],
        );
      });

      it('should collect entities to the correct group', async () => {
        await aggregator.runOnCategory(generateNormalizedCategory('-1'));
        await aggregator.runOnCategory(
          generateNormalizedCategory('-2', null, 'updated-category'),
        );
        await aggregator.runOnCategory(generateNormalizedCategory('-3'));

        await aggregator.runOnLabel(
          generateNormalizedLabel('-1', null, 'updated-label'),
        );
        await aggregator.runOnLabel(generateNormalizedLabel('-2'));
        await aggregator.runOnLabel(generateNormalizedLabel('-3'));

        await aggregator.runOnDocument(
          generateNormalizedDocument('-1', null, 'updated-document'),
        );
        await aggregator.runOnDocument(generateNormalizedDocument('-2'));
        await aggregator.runOnDocument(generateNormalizedDocument('-3'));

        verifyGroups(context.syncableContents.categories, 1, 1, 0);
        verifyGroups(context.syncableContents.labels, 1, 1, 0);
        verifyGroups(context.syncableContents.documents, 2, 1, 1);
      });

      describe('when contains protected fields', () => {
        beforeEach(() => {
          const doc1Alternatives = [
            {
              phrase: 'protected field 1',
              autocomplete: true,
            },
          ];
          const doc2Alternatives = [
            {
              phrase: 'protected field 2',
              autocomplete: true,
            },
            {
              phrase: 'protected field 3',
              autocomplete: true,
            },
          ];
          const doc1 = generateNormalizedDocument(
            '-1',
            null,
            'title1',
            doc1Alternatives,
          );
          const doc2 = generateNormalizedDocument(
            '-2',
            null,
            'title2',
            doc2Alternatives,
          );
          prepareStoredContent([], [], [doc1, doc2]);
        });

        it('should not update if the only change is a protected field', async () => {
          await aggregator.runOnDocument(
            generateNormalizedDocument('-1', null, 'title1'),
          );
          await aggregator.runOnDocument(
            generateNormalizedDocument('-2', null, 'updated title'),
          );

          verifyGroups(context.syncableContents.documents, 0, 1, 0);
          expect(
            context.syncableContents.documents.updated[0].published
              ?.alternatives?.length,
          ).toBe(2);
        });

        it('should handle primitive protected values', async () => {
          await aggregator.initialize(
            {
              protectedFields:
                'published.visible,published.title,published.alternatives',
            },
            adapters,
            context,
          );

          await aggregator.runOnDocument(
            generateNormalizedDocument('-1', null, 'title1', null, false),
          );
          await aggregator.runOnDocument(
            generateNormalizedDocument(
              '-2',
              null,
              'updated title',
              null,
              false,
            ),
          );

          verifyGroups(context.syncableContents.documents, 0, 0, 0);
        });
      });

      describe('when article has alternative externalId', () => {
        it('should update article with the alternative externalId', async () => {
          const doc = {
            ...generateNormalizedDocument(
              '-1',
              'document-id-1',
              undefined,
              null,
              undefined,
              ALTERNATIVE_EXTERNAL_ID,
            ),
            externalIdAlternatives: ['article-external-id-1'],
          };

          await aggregator.runOnDocument(doc);

          verifyGroups(context.syncableContents.documents, 0, 1, 1);
        });

        it('should not update article if only the alternative externalId is the difference', async () => {
          const doc = {
            ...generateNormalizedDocument('-1', 'document-id-1'),
            externalIdAlternatives: [ALTERNATIVE_EXTERNAL_ID],
          };

          await aggregator.runOnDocument(doc);

          verifyGroups(context.syncableContents.documents, 0, 0, 1);
        });
      });
    });

    function verifyGroups<T extends ExternalIdentifiable>(
      importableContent: ImportableContent<T>,
      createdCount: number,
      updatedCount: number,
      deletedCount: number,
    ): void {
      expect(importableContent.created.length).toBe(createdCount);
      expect(importableContent.updated.length).toBe(updatedCount);
      expect(importableContent.deleted.length).toBe(deletedCount);

      importableContent.deleted.forEach((d) => expect(d.id).not.toBeNull());
    }
  });

  function buildContext(): PipeContext {
    return {
      adapter: {
        processedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      pipe: {
        processedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
        unprocessedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
      },
      syncableContents: {
        categories: {
          created: [],
          updated: [],
          deleted: [],
        },
        labels: {
          created: [],
          updated: [],
          deleted: [],
        },
        documents: {
          created: [],
          updated: [],
          deleted: [],
        },
      },
      articleLookupTable: {},
    };
  }

  function prepareStoredContent(
    categories: Category[],
    labels: Label[],
    documents: Document[],
  ) {
    context.storedContent = {
      categories,
      labels,
      documents,
    };
    context.syncableContents.categories.deleted = [...categories];
    context.syncableContents.labels.deleted = [...labels];
    context.syncableContents.documents.deleted = [...documents];
  }
});
