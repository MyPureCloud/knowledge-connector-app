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
      categoryLookupTable: {},
      labelLookupTable: {},
    } as unknown as PipeContext;

    processor.initialize(config, adapters, context);
  });

  describe('runOnCategory', () => {
    describe('when there is a name conflict with category', () => {
      it('should alter entity name with suffix', async () => {
        const otherItem = generateNormalizedCategory(
          '-not-2',
          'category-id-not-2',
          'category-name-2',
        );
        prepareProcessedItem(
          otherItem,
          context.categoryLookupTable,
          context.pipe.processedItems.categories,
        );

        const newItem = generateNormalizedCategory('-2', 'category-id-2');
        prepareForProcessing(newItem, context.categoryLookupTable);

        const actual = await processor.runOnCategory(newItem);

        expectExternalEntity(
          actual,
          {
            id: null,
            name: 'category-name-2-suffix',
            externalId: 'category-external-id-2',
          },
          context.categoryLookupTable,
        );
      });

      describe('when still conflicting', () => {
        it('should alter entity name twice', async () => {
          prepareProcessedItem(
            generateNormalizedCategory('-1'),
            context.categoryLookupTable,
            context.pipe.processedItems.categories,
          );
          prepareProcessedItem(
            generateNormalizedCategory('-2'),
            context.categoryLookupTable,
            context.pipe.processedItems.categories,
          );
          prepareProcessedItem(
            generateNormalizedCategory('-3'),
            context.categoryLookupTable,
            context.pipe.processedItems.categories,
          );

          const newItem = generateNormalizedCategory(
            '-not-2-the-second',
            null,
            'category-name-2',
          );
          prepareForProcessing(newItem, context.categoryLookupTable);

          let actual = await processor.runOnCategory(newItem);

          expectExternalEntity(
            actual,
            {
              id: null,
              name: 'category-name-2-suffix',
              externalId: 'category-external-id-not-2-the-second',
            },
            context.categoryLookupTable,
          );
          prepareProcessedItem(
            newItem,
            context.categoryLookupTable,
            context.pipe.processedItems.categories,
          );

          const moreItem = generateNormalizedCategory(
            '-not-2-the-third',
            null,
            'category-name-2',
          );
          prepareForProcessing(moreItem, context.categoryLookupTable);

          actual = await processor.runOnCategory(moreItem);

          expectExternalEntity(
            actual,
            {
              id: null,
              name: 'category-name-2-suffix-suffix',
              externalId: 'category-external-id-not-2-the-third',
            },
            context.categoryLookupTable,
          );
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
    describe('when there is a name conflict', () => {
      it('should alter entity name with suffix', async () => {
        prepareProcessedItem(
          generateNormalizedLabel('-not-2', 'label-id-not-2', 'label-name-2'),
          context.labelLookupTable,
          context.pipe.processedItems.labels,
        );

        const newItem = generateNormalizedLabel('-2', 'label-id-2');
        prepareForProcessing(newItem, context.labelLookupTable);

        const actual = await processor.runOnLabel(newItem);

        expectExternalEntity(
          actual,
          {
            id: null,
            name: 'label-name-2-suffix',
            externalId: 'label-external-id-2',
          },
          context.labelLookupTable,
        );
      });

      describe('when still conflicting', () => {
        it('should alter entity name twice', async () => {
          prepareProcessedItem(
            generateNormalizedLabel('-1'),
            context.labelLookupTable,
            context.pipe.processedItems.labels,
          );
          prepareProcessedItem(
            generateNormalizedLabel('-2'),
            context.labelLookupTable,
            context.pipe.processedItems.labels,
          );
          prepareProcessedItem(
            generateNormalizedLabel('-3'),
            context.labelLookupTable,
            context.pipe.processedItems.labels,
          );

          const newItem = generateNormalizedLabel(
            '-not-2-the-second',
            null,
            'label-name-2',
          );
          prepareForProcessing(newItem, context.labelLookupTable);

          let actual = await processor.runOnLabel(newItem);

          expectExternalEntity(
            actual,
            {
              id: null,
              name: 'label-name-2-suffix',
              externalId: 'label-external-id-not-2-the-second',
            },
            context.labelLookupTable,
          );

          prepareProcessedItem(
            actual,
            context.labelLookupTable,
            context.pipe.processedItems.labels,
          );

          const moreItem = generateNormalizedLabel(
            '-not-2-the-third',
            null,
            'label-name-2',
          );
          prepareForProcessing(moreItem, context.labelLookupTable);

          actual = await processor.runOnLabel(moreItem);

          expectExternalEntity(
            actual,
            {
              id: null,
              name: 'label-name-2-suffix-suffix',
              externalId: 'label-external-id-not-2-the-third',
            },
            context.labelLookupTable,
          );
        });
      });
    });

    describe('when no suffix is configured', () => {
      beforeEach(() => {
        prepareProcessedItem(
          generateNormalizedLabel('-1'),
          context.labelLookupTable,
          context.pipe.processedItems.labels,
        );
        prepareProcessedItem(
          generateNormalizedLabel('-2'),
          context.labelLookupTable,
          context.pipe.processedItems.labels,
        );
        prepareProcessedItem(
          generateNormalizedLabel('-3'),
          context.labelLookupTable,
          context.pipe.processedItems.labels,
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

  function expectExternalEntity<T extends NamedEntity>(
    actual: NamedEntity | null,
    expected: NamedEntity,
    lookupTable: Record<string, T>,
  ): void {
    const { externalId, name } = actual!;
    expect({
      id: null,
      name,
      externalId,
    }).toStrictEqual(expected);

    expect(lookupTable[externalId!].name).toBe(name);
  }

  function prepareProcessedItem<T extends NamedEntity>(
    item: T,
    lookupTable: Record<string, T>,
    processedItemList: T[],
  ): void {
    processedItemList.push(item);
    lookupTable[item.externalId!] = item;
  }

  function prepareForProcessing<T extends NamedEntity>(
    item: T,
    lookupTable: Record<string, T>,
  ): void {
    lookupTable[item.externalId!] = item;
  }
});
