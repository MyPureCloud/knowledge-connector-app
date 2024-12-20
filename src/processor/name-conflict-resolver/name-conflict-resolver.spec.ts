import { beforeEach, describe, expect, it } from '@jest/globals';
import { NameConflictResolver } from './name-conflict-resolver.js';
import { NameConflictResolverConfig } from './name-conflict-resolver-config.js';
import { PipeContext } from '../../pipe/pipe-context.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import {
  generateNormalizedCategory,
  generateNormalizedLabel,
} from '../../tests/utils/entity-generators.js';
import { NamedEntity } from '../../model';
import { ConfigurerError } from '../../aggregator/errors/configurer-error.js';

describe('NameConflictResolver', () => {
  let processor: NameConflictResolver;
  let config: NameConflictResolverConfig;
  let context: PipeContext;
  let adapters: AdapterPair<Adapter, Adapter>;

  beforeEach(() => {
    config = {
      nameConflictSuffix: '-suffix',
    };
    adapters = {} as AdapterPair<Adapter, Adapter>;

    processor = new NameConflictResolver();
  });

  describe('runOnCategory', () => {
    beforeEach(() => {
      context = {
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
        storedContent: {
          categories: [],
          labels: [],
          documents: [],
        },
      } as unknown as PipeContext;

      processor.initialize(config, adapters, context);
    });

    describe('when there is a name conflict with category', () => {
      it('should alter entity name with suffix', async () => {
        context.pipe.processedItems.categories.push(
          generateNormalizedCategory(
            '-not-2',
            'category-id-not-2',
            'category-name-2',
          ),
        );

        const actual = await processor.runOnCategory(
          generateNormalizedCategory('-2', 'category-id-2'),
        );

        expectExternalEntity(actual, {
          id: null,
          name: 'category-name-2-suffix',
          externalId: 'category-external-id-2',
        });
      });

      describe('when still conflicting', () => {
        it('should alter entity name twice', async () => {
          context.pipe.processedItems.categories.push(
            generateNormalizedCategory('-1'),
            generateNormalizedCategory('-2'),
            generateNormalizedCategory('-3'),
          );

          let actual = await processor.runOnCategory(
            generateNormalizedCategory(
              '-not-2-the-second',
              null,
              'category-name-2',
            ),
          );

          expectExternalEntity(actual, {
            id: null,
            name: 'category-name-2-suffix',
            externalId: 'category-external-id-not-2-the-second',
          });

          context.pipe.processedItems.categories.push(actual);

          actual = await processor.runOnCategory(
            generateNormalizedCategory(
              '-not-2-the-third',
              null,
              'category-name-2',
            ),
          );

          expectExternalEntity(actual, {
            id: null,
            name: 'category-name-2-suffix-suffix',
            externalId: 'category-external-id-not-2-the-third',
          });
        });
      });
    });

    describe('when no suffix is configured', () => {
      beforeEach(() => {
        context.pipe.processedItems.categories.push(
          generateNormalizedCategory('-1'),
          generateNormalizedCategory('-2'),
          generateNormalizedCategory('-3'),
        );

        processor.initialize({}, adapters, context);
      });

      it('should throw configuration error', async () => {
        await expect(async () => {
          await processor.runOnCategory(
            generateNormalizedCategory('-not-2', null, 'category-name-2'),
          );
        }).rejects.toThrowError(
          new ConfigurerError(
            'Name conflict found "category-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
            { cause: 'name.conflict', item: 'category-name-2' },
          ),
        );
      });
    });
  });

  describe('runOnLabel', () => {
    beforeEach(() => {
      context = {
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
        storedContent: {
          categories: [],
          labels: [],
          documents: [],
        },
      } as unknown as PipeContext;

      processor.initialize(config, adapters, context);
    });

    describe('when there is a name conflict', () => {
      it('should alter entity name with suffix', async () => {
        context.pipe.processedItems.labels.push(
          generateNormalizedLabel('-not-2', 'label-id-not-2', 'label-name-2'),
        );

        const actual = await processor.runOnLabel(
          generateNormalizedLabel('-2', 'category-id-2'),
        );

        expectExternalEntity(actual, {
          id: null,
          name: 'label-name-2-suffix',
          externalId: 'label-external-id-2',
        });
      });

      describe('when still conflicting', () => {
        it('should alter entity name twice', async () => {
          context.pipe.processedItems.labels.push(
            generateNormalizedLabel('-1'),
            generateNormalizedLabel('-2'),
            generateNormalizedLabel('-3'),
          );

          let actual = await processor.runOnLabel(
            generateNormalizedLabel('-not-2-the-second', null, 'label-name-2'),
          );

          expectExternalEntity(actual, {
            id: null,
            name: 'label-name-2-suffix',
            externalId: 'label-external-id-not-2-the-second',
          });

          context.pipe.processedItems.labels.push(actual);

          actual = await processor.runOnLabel(
            generateNormalizedLabel('-not-2-the-third', null, 'label-name-2'),
          );

          expectExternalEntity(actual, {
            id: null,
            name: 'label-name-2-suffix-suffix',
            externalId: 'label-external-id-not-2-the-third',
          });
        });
      });
    });

    describe('when no suffix is configured', () => {
      beforeEach(() => {
        context.pipe.processedItems.labels.push(
          generateNormalizedLabel('-1'),
          generateNormalizedLabel('-2'),
          generateNormalizedLabel('-3'),
        );

        processor.initialize({}, adapters, context);
      });

      it('should throw configuration error', async () => {
        await expect(async () => {
          await processor.runOnLabel(
            generateNormalizedLabel('-not-2', null, 'label-name-2'),
          );
        }).rejects.toThrowError(
          new ConfigurerError(
            'Name conflict found "label-name-2". Try to use "NAME_CONFLICT_SUFFIX" variable',
            { cause: 'name.conflict', item: 'label-name-2' },
          ),
        );
      });
    });
  });

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
