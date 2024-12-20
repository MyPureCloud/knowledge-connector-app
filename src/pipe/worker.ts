import { getLogger } from '../utils/logger.js';
import { catcher } from '../utils/catch-error-helper.js';
import { TransformationError } from '../utils/errors/transformation-error.js';
import { ExternalIdentifiable } from '../model';
import { Processor } from '../processor/processor.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { Runnable } from './runnable.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Interrupted } from '../utils/errors/interrupted.js';
import _ from 'lodash';

export type Method<T> = (
  runnable: Runnable<unknown, unknown, unknown>,
  item: T,
  firstTry: boolean,
) => Promise<T>;

export class Worker<T extends ExternalIdentifiable> {
  private itemIterators: (() => AsyncGenerator<T, void, void>[]) | null = null;
  private processorList: Processor[] | null = null;
  private aggregatorList: Aggregator[] | null = null;
  private executeMethod: Method<T> | null = null;
  private processedItemList: T[] | null = null;
  private unprocessedItemList: T[] | null = null;

  public iterators(iterators: () => AsyncGenerator<T, void, void>[]): this {
    this.itemIterators = iterators;
    return this;
  }

  public processors(processors: Processor[]): this {
    this.processorList = processors;
    return this;
  }

  public aggregators(aggregators: Aggregator[]): this {
    this.aggregatorList = aggregators;
    return this;
  }

  public processedItems(processedItems: T[]): this {
    this.processedItemList = processedItems;
    return this;
  }

  public unprocessedItems(unprocessedItems: T[]): this {
    this.unprocessedItemList = unprocessedItems;
    return this;
  }

  public method(method: Method<T>): this {
    this.executeMethod = method;
    return this;
  }

  public async execute(): Promise<void> {
    const processors = validateNonNull(
      this.processorList,
      'Processors missing',
    );
    const aggregators = validateNonNull(
      this.aggregatorList,
      'Aggregators missing',
    );
    const method = validateNonNull(this.executeMethod, 'Method missing');
    const processedItems = validateNonNull(
      this.processedItemList,
      'ProcessedItems list missing',
    );
    const unprocessedItems = validateNonNull(
      this.unprocessedItemList,
      'UnprocessedItems list missing',
    );

    for await (const item of this.consumeIterators()) {
      getLogger().info(
        `Worker load next item with externalId: ${item.externalId}`,
      );
      try {
        const unprocessedItem = _.cloneDeep(item);
        const processedItem = await this.executeRunnable<T>(
          unprocessedItem,
          processors,
          method,
          true,
        );

        await this.executeRunnable<T>(processedItem, aggregators, method, true);

        processedItems.push(processedItem);
      } catch (error) {
        getLogger().warn(
          `Error processing item ${item.externalId}: ${error}`,
          error as Error,
        );
        await catcher()
          .on(Interrupted, (error) => {
            unprocessedItems.unshift(item);
            throw error;
          })
          .on(TransformationError, () => {
            unprocessedItems.unshift(item);
          })
          .any(() => {}) // TODO: push to errorList
          .with(error);
      }
    }

    getLogger().debug(
      `Processing ${unprocessedItems.length} postponed items in worker`,
    );
    while (unprocessedItems.length > 0) {
      const item = unprocessedItems.shift();

      try {
        const unprocessedItem = _.cloneDeep(item);
        const processedItem = await this.executeRunnable<T>(
          unprocessedItem!,
          processors,
          method,
          false,
        );

        await this.executeRunnable<T>(
          processedItem,
          aggregators,
          method,
          false,
        );

        processedItems.push(processedItem);
      } catch (error) {
        getLogger().warn(
          `Error processing (unprocessed) item ${item!.externalId}: ${error}`,
          error as Error,
        );
        await catcher()
          .on(Interrupted, (error) => {
            unprocessedItems.unshift(item!);
            throw error;
          })
          .any(() => {}) // TODO: push to errorList
          .with(error);
      }
    }
  }

  private async *consumeIterators(): AsyncGenerator<T, void, void> {
    const iterators = validateNonNull(this.itemIterators, 'Iterators missing');
    for (const iterator of iterators()) {
      for await (const item of iterator) {
        yield item;
      }
    }
  }

  private async executeRunnable<T>(
    item: T,
    runnableList: Runnable<unknown, unknown, unknown>[],
    method: Method<T>,
    firstTry: boolean,
  ): Promise<T> {
    for (const runnable of runnableList) {
      item = await method(runnable, item, firstTry);
    }
    return item;
  }
}
