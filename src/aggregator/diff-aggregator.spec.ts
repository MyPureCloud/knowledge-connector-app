import { DiffAggregator } from './diff-aggregator.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import {
  generateCategory,
  generateDocument,
  generateLabel,
} from '../tests/utils/entity-generators.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { Document, ImportExportModel } from '../model/import-export-model.js';
import { ImportableContent } from '../model/syncable-contents.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { ExternalIdentifiable } from '../model/external-identifiable.js';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('DiffAggregator', () => {
  let sourceAdapter: SourceAdapter<Category, Label, Document>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<Adapter, DestinationAdapter>;
  let aggregator: DiffAggregator;
  let mockExportAllEntities: jest.Mock<() => Promise<ImportExportModel>>;

  describe('run', () => {
    beforeEach(() => {
      sourceAdapter = {} as typeof sourceAdapter;
      destinationAdapter = new GenesysDestinationAdapter();
      mockExportAllEntities = destinationAdapter.exportAllEntities as jest.Mock<
        () => Promise<ImportExportModel>
      >;
      adapters = {
        sourceAdapter,
        destinationAdapter,
      };
      aggregator = new DiffAggregator();

      aggregator.initialize(
        { protectedFields: 'published.alternatives' },
        adapters,
      );
    });

    describe('when export from destination is empty', () => {
      beforeEach(() => {
        mockExportAllEntities.mockResolvedValue({
          version: 3,
          importAction: {
            knowledgeBase: {
              id: '',
            },
            documents: [],
            categories: [],
            labels: [],
          },
          deleteAction: {
            documents: [],
            categories: [],
            labels: [],
          },
        });
      });

      it('should collect all entities to the created group', async () => {
        const importableContents = await aggregator.run({
          categories: [
            generateCategory('1'),
            generateCategory('2'),
            generateCategory('3'),
          ],
          labels: [generateLabel('1'), generateLabel('2'), generateLabel('3')],
          documents: [
            generateDocument('1'),
            generateDocument('2'),
            generateDocument('3'),
          ],
        });

        verifyGroups(importableContents.categories, 3, 0, 0);
        verifyGroups(importableContents.labels, 3, 0, 0);
        verifyGroups(importableContents.documents, 3, 0, 0);
      });
    });

    describe('when export from destination is not empty', () => {
      beforeEach(() => {
        mockExportAllEntities.mockResolvedValue({
          version: 3,
          importAction: {
            knowledgeBase: {
              id: '',
            },
            categories: [generateCategory('1'), generateCategory('2')],
            labels: [generateLabel('1'), generateLabel('2')],
            documents: [generateDocument('1'), generateDocument('4')],
          },
          deleteAction: {
            categories: [],
            labels: [],
            documents: [],
          },
        });
      });

      it('should collect entities to the correct group', async () => {
        const importableContents = await aggregator.run({
          categories: [
            generateCategory('1'),
            generateCategory('2', 'updated-category'),
            generateCategory('3'),
          ],
          labels: [
            generateLabel('1', 'updated-label'),
            generateLabel('2'),
            generateLabel('3'),
          ],
          documents: [
            generateDocument('1', 'updated-document'),
            generateDocument('2'),
            generateDocument('3'),
          ],
        });

        verifyGroups(importableContents.categories, 1, 1, 0);
        verifyGroups(importableContents.labels, 1, 1, 0);
        verifyGroups(importableContents.documents, 2, 1, 1);
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
          const doc1 = generateDocument('1', 'title1', doc1Alternatives);
          const doc2 = generateDocument('2', 'title2', doc2Alternatives);
          mockExportAllEntities.mockResolvedValue({
            version: 3,
            importAction: {
              knowledgeBase: {
                id: '',
              },
              documents: [doc1, doc2],
              categories: [],
              labels: [],
            },
            deleteAction: {
              documents: [],
              categories: [],
              labels: [],
            },
          });
        });

        it('should not update if the only change is a protected field', async () => {
          const importableContents = await aggregator.run({
            categories: [],
            labels: [],
            documents: [
              generateDocument('1', 'title1'),
              generateDocument('2', 'updated title'),
            ],
          });

          verifyGroups(importableContents.documents, 0, 1, 0);
          const alternatives =
            importableContents.documents.updated[0].published?.alternatives;
          expect(alternatives?.length).toBe(2);
        });

        it('should handle primitive protected values', async () => {
          await aggregator.initialize(
            {
              protectedFields:
                'published.visible,published.title,published.alternatives',
            },
            adapters,
          );

          const importableContents = await aggregator.run({
            categories: [],
            labels: [],
            documents: [
              generateDocument('1', 'title1', null, false),
              generateDocument('2', 'updated title', null, false),
            ],
          });

          verifyGroups(importableContents.documents, 0, 0, 0);
        });
      });

      describe('when there is a name conflict with category', () => {
        describe('when suffix is configured', () => {
          beforeEach(() => {
            aggregator.initialize(
              {
                nameConflictSuffix: '-suffix',
              },
              adapters,
            );
          });

          it('should alter entity name with suffix', async () => {
            const importableContents = await aggregator.run({
              categories: [
                generateCategory('1'),
                generateCategory('not-2', 'category-name2'),
                generateCategory('3'),
              ],
              labels: [],
              documents: [],
            });

            verifyGroups(importableContents.categories, 2, 0, 1);
            verifyGroups(importableContents.labels, 0, 0, 2);
            verifyGroups(importableContents.documents, 0, 0, 2);

            expect(importableContents.categories.created[0].name).toBe(
              'category-name2-suffix',
            );
            expect(importableContents.categories.created[0].externalId).toBe(
              'categories-not-2',
            );
          });

          describe('when still conflicting with the suffix', () => {
            beforeEach(() => {
              mockExportAllEntities.mockResolvedValue({
                version: 3,
                importAction: {
                  knowledgeBase: {
                    id: '',
                  },
                  categories: [
                    generateCategory('1'),
                    generateCategory('2'),
                    generateCategory('2-suffix'),
                  ],
                  labels: [],
                  documents: [],
                },
                deleteAction: {
                  categories: [],
                  documents: [],
                  labels: [],
                },
              });
            });

            it('should throw error', async () => {
              await expect(async () => {
                await aggregator.run({
                  categories: [
                    generateCategory('1'),
                    generateCategory('not-2', 'category-name2'),
                    generateCategory('3'),
                  ],
                  labels: [],
                  documents: [],
                });
              }).rejects.toThrow(
                'Name conflict found with suffix "category-name2-suffix". Try to use different "NAME_CONFLICT_SUFFIX" variable',
              );
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [generateCategory('not-2', 'category-name2')],
                labels: [],
                documents: [],
              });
            }).rejects.toThrow(
              'Name conflict found "category-name2". Try to use "NAME_CONFLICT_SUFFIX" variable',
            );
          });
        });
      });

      describe('when there is a name conflict with label', () => {
        describe('when suffix is configured', () => {
          beforeEach(() => {
            aggregator.initialize(
              {
                nameConflictSuffix: '-suffix',
              },
              adapters,
            );
          });

          it('should alter entity name with suffix', async () => {
            const importableContents = await aggregator.run({
              categories: [],
              labels: [
                generateLabel('1'),
                generateLabel('not-2', 'label-name2'),
              ],
              documents: [],
            });

            verifyGroups(importableContents.categories, 0, 0, 2);
            verifyGroups(importableContents.labels, 1, 0, 1);
            verifyGroups(importableContents.documents, 0, 0, 2);

            expect(importableContents.labels.created[0].name).toBe(
              'label-name2-suffix',
            );
            expect(importableContents.labels.created[0].externalId).toBe(
              'labels-not-2',
            );
          });

          describe('when still conflicting with the suffix', () => {
            beforeEach(() => {
              mockExportAllEntities.mockResolvedValue({
                version: 3,
                importAction: {
                  knowledgeBase: {
                    id: '',
                  },
                  categories: [],
                  labels: [
                    generateLabel('1'),
                    generateLabel('2'),
                    generateLabel('2-suffix'),
                  ],
                  documents: [],
                },
                deleteAction: {
                  categories: [],
                  labels: [],
                  documents: [],
                },
              });
            });

            it('should throw error', async () => {
              await expect(async () => {
                await aggregator.run({
                  categories: [],
                  labels: [
                    generateLabel('1'),
                    generateLabel('not-2', 'label-name2'),
                    generateLabel('3'),
                  ],
                  documents: [],
                });
              }).rejects.toThrow(
                'Name conflict found with suffix "label-name2-suffix". Try to use different "NAME_CONFLICT_SUFFIX" variable',
              );
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [generateCategory('not-2', 'category-name2')],
                labels: [],
                documents: [],
              });
            }).rejects.toThrow(
              'Name conflict found "category-name2". Try to use "NAME_CONFLICT_SUFFIX" variable',
            );
          });
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
});
