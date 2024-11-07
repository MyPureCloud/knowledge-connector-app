import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DiffAggregator } from './diff-aggregator.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedDocumentWithInternalDocumentLinks,
  generateNormalizedLabel,
} from '../tests/utils/entity-generators.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { ExportModel, SyncModel } from '../model/sync-export-model.js';
import { ImportableContent } from '../model/syncable-contents.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import { ConfigurerError } from './errors/configurer-error.js';
import { NamedEntity } from '../model/named-entity.js';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('DiffAggregator', () => {
  let sourceAdapter: SourceAdapter<Category, Label, Document>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<Adapter, DestinationAdapter>;
  let aggregator: DiffAggregator;
  let mockExportAllEntities: jest.Mock<() => Promise<ExportModel>>;

  describe('run', () => {
    beforeEach(async () => {
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

      await aggregator.initialize(
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

    describe('when export contains generated fields', () => {
      beforeEach(() => {
        mockExportAllEntities.mockResolvedValue({
          version: 3,
          importAction: {
            knowledgeBase: {
              id: '',
            },
            categories: [],
            labels: [],
            documents: [
              generateNormalizedDocumentWithInternalDocumentLinks(
                '-1',
                'https://modified.url/article/123',
              ),
            ],
          },
        });
      });

      it('should remove generated content and thus not detect change', async () => {
        const importableContents = await aggregator.run({
          categories: [],
          labels: [],
          documents: [
            generateNormalizedDocumentWithInternalDocumentLinks(
              '-1',
              undefined,
            ),
          ],
        });

        expect(importableContents.documents.created.length).toBe(0);
        expect(importableContents.documents.updated.length).toBe(0);
        expect(importableContents.documents.deleted.length).toBe(0);
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
          beforeEach(async () => {
            await aggregator.initialize(
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
                generateNormalizedCategory('-2', 'category-id-2'),
                generateNormalizedCategory(
                  '-not-2',
                  'category-id-not-2',
                  'category-name-2',
                ),
                generateNormalizedCategory('-3'),
              ],
              labels: [generateNormalizedLabel('-1', 'label-id-1')],
              documents: [generateNormalizedDocument('-1', 'document-id-1')],
            });

            verifyGroups(importableContents.categories, 2, 0, 0);
            verifyGroups(importableContents.labels, 0, 0, 1);
            verifyGroups(importableContents.documents, 0, 0, 1);

            expectExternalEntity(importableContents.categories.created[0], {
              id: null,
              name: 'category-name-2-suffix',
              externalId: 'category-external-id-not-2',
            });
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
                    generateNormalizedCategory('-1', 'category-id-1'),
                    generateNormalizedCategory('-2', 'category-id-2'),
                    generateNormalizedCategory(
                      '-not-2-the-first',
                      'category-id-not-2-the-first',
                      'category-name-2-suffix-suffix',
                    ),
                  ],
                  labels: [],
                  documents: [],
                },
              });
            });

            it('should alter entity name twice', async () => {
              const importableContents = await aggregator.run({
                categories: [
                  generateNormalizedCategory('-1'),
                  generateNormalizedCategory('-2'),
                  generateNormalizedCategory('-3'),
                  generateNormalizedCategory(
                    '-not-2-the-second',
                    null,
                    'category-name-2',
                  ),
                  generateNormalizedCategory(
                    '-not-2-the-third',
                    null,
                    'category-name-2',
                  ),
                ],
                labels: [],
                documents: [],
              });

              verifyGroups(importableContents.categories, 3, 0, 1);
              verifyGroups(importableContents.labels, 0, 0, 0);
              verifyGroups(importableContents.documents, 0, 0, 0);

              expectExternalEntity(importableContents.categories.created[1], {
                id: null,
                name: 'category-name-2-suffix',
                externalId: 'category-external-id-not-2-the-second',
              });
              expectExternalEntity(importableContents.categories.created[2], {
                id: null,
                name: 'category-name-2-suffix-suffix-suffix',
                externalId: 'category-external-id-not-2-the-third',
              });
            });
          });

          describe('when conflicting category is referred in document', () => {
            it('should use the resolved name', async () => {
              const document = generateNormalizedDocument(
                '-1',
                'document-id-1',
              );
              document.published!.category = {
                id: 'category-external-id-not-1',
                name: 'category-name-1',
              };
              const importableContents = await aggregator.run({
                categories: [
                  generateNormalizedCategory('-1', 'category-id-1'),
                  generateNormalizedCategory('-2', 'category-id-2'),
                  generateNormalizedCategory('-not-1', null, 'category-name-1'),
                ],
                labels: [generateNormalizedLabel('-1')],
                documents: [document],
              });

              verifyGroups(importableContents.categories, 1, 0, 0);
              verifyGroups(importableContents.labels, 0, 0, 1);
              verifyGroups(importableContents.documents, 0, 1, 1);

              expect(
                importableContents.documents.updated[0].published!.category!
                  .name,
              ).toBe('category-name-1-suffix');
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw configuration error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [
                  generateNormalizedCategory('-not-2', null, 'category-name-2'),
                ],
                labels: [],
                documents: [],
              });
            }).rejects.toThrowError(
              new ConfigurerError(
                'Name conflict found "category-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
                { cause: 'name.conflict', item: 'category-name-2' },
              ),
            );
          });
        });
      });

      describe('when there is a name conflict with label', () => {
        describe('when suffix is configured', () => {
          beforeEach(async () => {
            await aggregator.initialize(
              {
                nameConflictSuffix: '-suffix',
              },
              adapters,
            );
          });

          it('should alter entity name with suffix', async () => {
            const importableContents = await aggregator.run({
              categories: [generateNormalizedCategory('-1')],
              labels: [
                generateNormalizedLabel('-1'),
                generateNormalizedLabel('-not-2', null, 'label-name-2'),
              ],
              documents: [generateNormalizedDocument('-1', 'document-id-1')],
            });

            verifyGroups(importableContents.categories, 0, 0, 1);
            verifyGroups(importableContents.labels, 1, 0, 1);
            verifyGroups(importableContents.documents, 0, 0, 1);

            expectExternalEntity(importableContents.labels.created[0], {
              id: null,
              name: 'label-name-2-suffix',
              externalId: 'label-external-id-not-2',
            });
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
                    generateNormalizedLabel(
                      '-2-suffix',
                      'category-to-be-deleted-id',
                    ),
                  ],
                  documents: [],
                },
              });
            });

            it('should alter entity name twice', async () => {
              const importableContents = await aggregator.run({
                categories: [],
                labels: [
                  generateNormalizedLabel('-1'),
                  generateNormalizedLabel('-2'),
                  generateNormalizedLabel('-not-2', null, 'label-name-2'),
                  generateNormalizedLabel('-3'),
                ],
                documents: [],
              });

              verifyGroups(importableContents.categories, 0, 0, 0);
              verifyGroups(importableContents.labels, 2, 0, 1);
              verifyGroups(importableContents.documents, 0, 0, 0);

              expectExternalEntity(importableContents.labels.created[0], {
                id: null,
                name: 'label-name-2-suffix-suffix',
                externalId: 'label-external-id-not-2',
              });
              expectExternalEntity(importableContents.labels.created[1], {
                id: null,
                name: 'label-name-3',
                externalId: 'label-external-id-3',
              });
            });
          });
        });

        describe('when no suffix is configured', () => {
          it('should throw configuration error', async () => {
            await expect(async () => {
              await aggregator.run({
                categories: [
                  generateNormalizedCategory('-not-2', null, 'category-name-2'),
                ],
                labels: [],
                documents: [],
              });
            }).rejects.toThrowError(
              new ConfigurerError(
                'Name conflict found "category-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
                { cause: 'name.conflict', item: 'category-name-2' },
              ),
            );
          });
        });
      });
    });

    describe('when syncing from multiple sources', () => {
      describe('when externalIdPrefix given', () => {
        const EXTERNAL_PREFIX_1: string = 'external-prefix-1';
        const EXTERNAL_PREFIX_2: string = 'external-prefix-2';

        beforeEach(async () => {
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
                  `${EXTERNAL_PREFIX_1}-category-external-id-1`,
                ),
                generateNormalizedCategory(
                  '',
                  'category-id-2',
                  'category-source2',
                  `${EXTERNAL_PREFIX_2}-category-external-id-1`,
                ),
                generateNormalizedCategory(
                  '',
                  'category-id-3',
                  'category-del-source2',
                  `${EXTERNAL_PREFIX_2}-category-external-id-2`,
                ),
              ],
              labels: [
                generateNormalizedLabel(
                  '',
                  'label-id-1',
                  'label-source1',
                  `${EXTERNAL_PREFIX_1}-label-external-id-1`,
                ),
                generateNormalizedLabel(
                  '',
                  'label-id-2',
                  'label-source2',
                  `${EXTERNAL_PREFIX_2}-label-external-id-2`,
                ),
                generateNormalizedLabel(
                  '',
                  'label-id-3',
                  'label-del-source2',
                  `${EXTERNAL_PREFIX_2}-label-external-id-3`,
                ),
              ],
              documents: [
                generateNormalizedDocument(
                  '-1',
                  'document-id-1',
                  'document-source1',
                  [],
                  true,
                  `${EXTERNAL_PREFIX_1}-article-external-id-1`,
                ),
                generateNormalizedDocument(
                  '-1',
                  'document-id-2',
                  'document-source2',
                  [],
                  true,
                  `${EXTERNAL_PREFIX_2}-article-external-id-1`,
                ),
                generateNormalizedDocument(
                  '-2',
                  'document-id-3',
                  'document-del-source2',
                  [],
                  true,
                  `${EXTERNAL_PREFIX_2}-article-external-id-2`,
                ),
              ],
            },
          });

          await aggregator.initialize(
            { externalIdPrefix: EXTERNAL_PREFIX_2 },
            adapters,
          );
        });

        it('should collect entities to the correct group', async () => {
          const importableContents = await aggregator.run({
            categories: [
              generateNormalizedCategory(
                '-1',
                null,
                'category-update',
                `${EXTERNAL_PREFIX_2}-category-external-id-1`,
              ),
              generateNormalizedCategory(
                '-3',
                null,
                'category-new',
                `${EXTERNAL_PREFIX_2}-category-external-id-3`,
              ),
            ],
            labels: [
              generateNormalizedLabel(
                '',
                'label-id-1',
                'label-update',
                `${EXTERNAL_PREFIX_2}-label-external-id-1`,
              ),
              generateNormalizedLabel(
                '',
                'label-id-3',
                'label-new',
                `${EXTERNAL_PREFIX_2}-label-external-id-3`,
              ),
            ],
            documents: [
              generateNormalizedDocument(
                '-1',
                null,
                'document-update',
                [],
                true,
                `${EXTERNAL_PREFIX_2}-article-external-id-1`,
              ),
              generateNormalizedDocument(
                '-3',
                null,
                'document-new',
                [],
                true,
                `${EXTERNAL_PREFIX_2}-article-external-id-3`,
              ),
            ],
          });

          verifyGroups(importableContents.categories, 1, 1, 1);
          verifyGroups(importableContents.labels, 1, 1, 1);
          verifyGroups(importableContents.documents, 1, 1, 1);
        });
      });

      describe('when genesysSourceId given', () => {
        const SOURCE_ID_1: string = 'source-id-1';
        const SOURCE_ID_2: string = 'source-id-2';

        beforeEach(async () => {
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
                  `category-external-id-1-1`,
                  null,
                  SOURCE_ID_1,
                ),
                generateNormalizedCategory(
                  '',
                  'category-id-2',
                  'category-source2',
                  `category-external-id-2-1`,
                  null,
                  SOURCE_ID_2,
                ),
                generateNormalizedCategory(
                  '',
                  'category-id-3',
                  'category-del-source2',
                  `category-external-id-2-2`,
                  null,
                  SOURCE_ID_2,
                ),
              ],
              labels: [
                generateNormalizedLabel(
                  '',
                  'label-id-1',
                  'label-source1',
                  `label-external-id-1-1`,
                  SOURCE_ID_1,
                ),
                generateNormalizedLabel(
                  '',
                  'label-id-2',
                  'label-source2',
                  `label-external-id-2-1`,
                  SOURCE_ID_2,
                ),
                generateNormalizedLabel(
                  '',
                  'label-id-3',
                  'label-del-source2',
                  `label-external-id-2-2`,
                  SOURCE_ID_2,
                ),
              ],
              documents: [
                generateNormalizedDocument(
                  '-1',
                  'document-id-1',
                  'document-source1',
                  [],
                  true,
                  `article-external-id-1-1`,
                  SOURCE_ID_1,
                ),
                generateNormalizedDocument(
                  '-1',
                  'document-id-2',
                  'document-source2',
                  [],
                  true,
                  `article-external-id-2-1`,
                  SOURCE_ID_2,
                ),
                generateNormalizedDocument(
                  '-2',
                  'document-id-3',
                  'document-del-source2',
                  [],
                  true,
                  `article-external-id-2-2`,
                  SOURCE_ID_2,
                ),
              ],
            },
          });

          await aggregator.initialize(
            { genesysSourceId: SOURCE_ID_2 },
            adapters,
          );
        });

        it('should collect entities to the correct group', async () => {
          const importableContents = await aggregator.run({
            categories: [
              generateNormalizedCategory(
                '',
                null,
                'category-update',
                `category-external-id-2-1`,
              ),
              generateNormalizedCategory(
                '',
                null,
                'category-new',
                `category-external-id-2-3`,
              ),
            ],
            labels: [
              generateNormalizedLabel(
                '',
                'label-id-1',
                'label-update',
                `label-external-id-2-1`,
              ),
              generateNormalizedLabel(
                '',
                'label-id-3',
                'label-new',
                `label-external-id-2-3`,
              ),
            ],
            documents: [
              generateNormalizedDocument(
                '',
                null,
                'document-update',
                [],
                true,
                `article-external-id-2-1`,
              ),
              generateNormalizedDocument(
                '',
                null,
                'document-new',
                [],
                true,
                `article-external-id-2-3`,
              ),
            ],
          });

          verifyGroups(importableContents.categories, 1, 1, 1);
          verifyGroups(importableContents.labels, 1, 1, 1);
          verifyGroups(importableContents.documents, 1, 1, 1);
        });
      });
    });

    describe('when source list is empty', () => {
      describe('when destination is not empty', () => {
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

        it('should throw configurer error', async () => {
          await expect(async () => {
            await aggregator.run({
              categories: [
                generateNormalizedCategory('-1', 'category-id-1'),
                generateNormalizedCategory('-2', 'category-id-2'),
                generateNormalizedCategory('-3', 'category-id-3'),
              ],
              labels: [
                generateNormalizedLabel('-1', 'label-id-1'),
                generateNormalizedLabel('-2', 'label-id-2'),
                generateNormalizedLabel('-3', 'label-id-3'),
              ],
              documents: [],
            });
          }).rejects.toThrowError(
            new ConfigurerError('Prune all entities are not allowed', {
              cause: 'prune.all.entities',
            }),
          );
        });

        describe('when ALLOW_PRUNE_ALL_ENTITIES is on', () => {
          it('should delete all entities', async () => {
            await aggregator.initialize(
              { allowPruneAllEntities: 'true' },
              adapters,
            );

            const result = await aggregator.run({
              categories: [
                generateNormalizedCategory('-1', 'category-id-1'),
                generateNormalizedCategory('-2', 'category-id-2'),
                generateNormalizedCategory('-3', 'category-id-3'),
              ],
              labels: [
                generateNormalizedLabel('-1', 'label-id-1'),
                generateNormalizedLabel('-2', 'label-id-2'),
                generateNormalizedLabel('-3', 'label-id-3'),
              ],
              documents: [],
            });

            expect(result.documents.deleted.length).toBe(2);
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

    function expectExternalEntity(
      actual: NamedEntity | null,
      expected: NamedEntity,
    ): void {
      const { externalId, name } = actual!;
      expect({
        id: null,
        name,
        externalId,
      }).toStrictEqual(expected);
    }
  });
});
