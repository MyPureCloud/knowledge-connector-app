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
import {
  Document,
  ExportModel,
  SyncModel,
} from '../model/sync-export-model.js';
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
  let mockExportAllEntities: jest.Mock<() => Promise<ExportModel>>;

  describe('run', () => {
    beforeEach(() => {
      sourceAdapter = {} as typeof sourceAdapter;
      destinationAdapter = new GenesysDestinationAdapter();
      mockExportAllEntities = destinationAdapter.exportAllEntities as jest.Mock<
        () => Promise<SyncModel>
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
        });
      });

      it('should collect all entities to the created group', async () => {
        const importableContents = await aggregator.run({
          categories: [
            generateNormalizedCategory('-1'),
            generateNormalizedCategory('-2'),
            generateNormalizedCategory('-3'),
          ],
          labels: [
            generateNormalizedLabel('-1'),
            generateNormalizedLabel('-2'),
            generateNormalizedLabel('-3'),
          ],
          documents: [
            generateNormalizedDocument('-1'),
            generateNormalizedDocument('-2'),
            generateNormalizedDocument('-3'),
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
            categories: [
              generateNormalizedCategory('-1', 'category-id-1'),
              generateNormalizedCategory('-2', 'category-id-2'),
            ],
            labels: [
              generateNormalizedLabel('-1', 'label-id-1'),
              generateNormalizedLabel('-2', 'label-id-2'),
            ],
            documents: [
              generateNormalizedDocument('-1', 'document-id-1'),
              generateNormalizedDocument('-4', 'document-id-4'),
            ],
          },
        });
      });

      it('should collect entities to the correct group', async () => {
        const importableContents = await aggregator.run({
          categories: [
            generateNormalizedCategory('-1'),
            generateNormalizedCategory('-2', null, 'updated-category'),
            generateNormalizedCategory('-3'),
          ],
          labels: [
            generateNormalizedLabel('-1', null, 'updated-label'),
            generateNormalizedLabel('-2'),
            generateNormalizedLabel('-3'),
          ],
          documents: [
            generateNormalizedDocument('-1', null, 'updated-document'),
            generateNormalizedDocument('-2'),
            generateNormalizedDocument('-3'),
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
          });
        });

        it('should not update if the only change is a protected field', async () => {
          const importableContents = await aggregator.run({
            categories: [],
            labels: [],
            documents: [
              generateNormalizedDocument('-1', null, 'title1'),
              generateNormalizedDocument('-2', null, 'updated title'),
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
              generateNormalizedDocument('-1', null, 'title1', null, false),
              generateNormalizedDocument(
                '-2',
                null,
                'updated title',
                null,
                false,
              ),
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
                generateNormalizedCategory('-1'),
                generateNormalizedCategory('-not-2', null, 'category-name-2'),
                generateNormalizedCategory('-3'),
              ],
              labels: [],
              documents: [],
            });

            verifyGroups(importableContents.categories, 2, 0, 1);
            verifyGroups(importableContents.labels, 0, 0, 2);
            verifyGroups(importableContents.documents, 0, 0, 2);

            expect(importableContents.categories.created[0].name).toBe(
              'category-name-2-suffix',
            );
            expect(importableContents.categories.created[0].externalId).toBe(
              'category-external-id-not-2',
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
                    generateNormalizedCategory('-1'),
                    generateNormalizedCategory('-2'),
                    generateNormalizedCategory('-2-suffix'),
                  ],
                  labels: [],
                  documents: [],
                },
              });
            });

            it('should throw error', async () => {
              await expect(async () => {
                await aggregator.run({
                  categories: [
                    generateNormalizedCategory('-1'),
                    generateNormalizedCategory(
                      '-not-2',
                      null,
                      'category-name-2',
                    ),
                    generateNormalizedCategory('-3'),
                  ],
                  labels: [],
                  documents: [],
                });
              }).rejects.toThrow(
                'Name conflict found with suffix "category-name-2-suffix". Try to use different "NAME_CONFLICT_SUFFIX" variable',
              );
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [
                  generateNormalizedCategory('-not-2', null, 'category-name-2'),
                ],
                labels: [],
                documents: [],
              });
            }).rejects.toThrow(
              'Name conflict found "category-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
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
                generateNormalizedLabel('-1'),
                generateNormalizedLabel('-not-2', null, 'label-name-2'),
              ],
              documents: [],
            });

            verifyGroups(importableContents.categories, 0, 0, 2);
            verifyGroups(importableContents.labels, 1, 0, 1);
            verifyGroups(importableContents.documents, 0, 0, 2);

            expect(importableContents.labels.created[0].name).toBe(
              'label-name-2-suffix',
            );
            expect(importableContents.labels.created[0].externalId).toBe(
              'label-external-id-not-2',
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
                    generateNormalizedLabel('-1'),
                    generateNormalizedLabel('-2'),
                    generateNormalizedLabel('-2-suffix'),
                  ],
                  documents: [],
                },
              });
            });

            it('should throw error', async () => {
              await expect(async () => {
                await aggregator.run({
                  categories: [],
                  labels: [
                    generateNormalizedLabel('-1'),
                    generateNormalizedLabel('-not-2', null, 'label-name-2'),
                    generateNormalizedLabel('-3'),
                  ],
                  documents: [],
                });
              }).rejects.toThrow(
                'Name conflict found with suffix "label-name-2-suffix". Try to use different "NAME_CONFLICT_SUFFIX" variable',
              );
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [
                  generateNormalizedCategory('-not-2', null, 'category-name-2'),
                ],
                labels: [],
                documents: [],
              });
            }).rejects.toThrow(
              'Name conflict found "category-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
            );
          });
        });
      });
    });

    describe('when syncing from multiple sources', () => {
      const source1: string = 'source1';
      const source2: string = 'source2';
      beforeEach(() => {
        mockExportAllEntities.mockResolvedValue({
          version: 3,
          importAction: {
            knowledgeBase: {
              id: '',
            },
            categories: [
              generateNormalizedCategory(
                '',
                'category-id-1',
                'category-source1',
                `${source1}-category-external-id-1`,
              ),
              generateNormalizedCategory(
                '',
                'category-id-2',
                'category-source2',
                `${source2}-category-external-id-1`,
              ),
              generateNormalizedCategory(
                '',
                'category-id-3',
                'category-del-source2',
                `${source2}-category-external-id-2`,
              ),
            ],
            labels: [
              generateNormalizedLabel(
                '',
                'label-id-1',
                'label-source1',
                `${source1}-label-external-id-1`,
              ),
              generateNormalizedLabel(
                '',
                'label-id-2',
                'label-source2',
                `${source2}-label-external-id-2`,
              ),
              generateNormalizedLabel(
                '',
                'label-id-3',
                'label-del-source2',
                `${source2}-label-external-id-3`,
              ),
            ],
            documents: [
              generateNormalizedDocument(
                '-1',
                'document-id-1',
                'document-source1',
                [],
                true,
                `${source1}-article-external-id-1`,
              ),
              generateNormalizedDocument(
                '-1',
                'document-id-2',
                'document-source2',
                [],
                true,
                `${source2}-article-external-id-1`,
              ),
              generateNormalizedDocument(
                '-2',
                'document-id-3',
                'document-del-source2',
                [],
                true,
                `${source2}-article-external-id-2`,
              ),
            ],
          },
        });

        aggregator.initialize({ externalIdPrefix: source2 }, adapters);
      });

      it('should collect entities to the correct group', async () => {
        const importableContents = await aggregator.run({
          categories: [
            generateNormalizedCategory(
              '-1',
              null,
              'category-update',
              `${source2}-category-external-id-1`,
            ),
            generateNormalizedCategory(
              '-3',
              null,
              'category-new',
              `${source2}-category-external-id-3`,
            ),
          ],
          labels: [
            generateNormalizedLabel(
              '',
              'label-id-1',
              'label-update',
              `${source2}-label-external-id-1`,
            ),
            generateNormalizedLabel(
              '',
              'label-id-3',
              'label-new',
              `${source2}-label-external-id-3`,
            ),
          ],
          documents: [
            generateNormalizedDocument(
              '-1',
              null,
              'document-update',
              [],
              true,
              `${source2}-article-external-id-1`,
            ),
            generateNormalizedDocument(
              '-3',
              null,
              'document-new',
              [],
              true,
              `${source2}-article-external-id-3`,
            ),
          ],
        });

        verifyGroups(importableContents.categories, 1, 1, 1);
        verifyGroups(importableContents.labels, 1, 1, 1);
        verifyGroups(importableContents.documents, 1, 1, 1);
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
