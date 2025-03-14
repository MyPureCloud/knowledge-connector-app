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
import { ErrorBasePublic } from '../utils/errors/error-base-public.js';
import { ErrorCodes } from '../utils/errors/error-codes.js';
import { EntityWithMetadata } from '../model/entity-with-metadata.js';
import { Filter } from '../filter/filter.js';

export type Method<T> = (
  runnable: Runnable<unknown, unknown, unknown>,
  item: T,
  firstTry: boolean,
) => Promise<T>;

export class Worker<T extends ExternalIdentifiable> {
  private itemIterators: (() => AsyncGenerator<T, void, void>[]) | null = null;
  private processorList: Processor[] | null = null;
  private filterList: Filter[] | null = null;
  private aggregatorList: Aggregator[] | null = null;
  private executeMethod: Method<T> | null = null;
  private processedItemList: T[] | null = null;
  private unprocessedItemList: T[] | null = null;
  private failedItemList: EntityWithMetadata<T>[] | null = null;

  public iterators(iterators: () => AsyncGenerator<T, void, void>[]): this {
    this.itemIterators = iterators;
    return this;
  }

  public processors(processors: Processor[]): this {
    this.processorList = processors;
    return this;
  }

  public filters(filters: Filter[]): this {
    this.filterList = filters;
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

  public failedItems(failedItems: EntityWithMetadata<T>[]): this {
    this.failedItemList = failedItems;
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
    const filters = validateNonNull(this.filterList, 'Filters missing');
    const method = validateNonNull(this.executeMethod, 'Method missing');
    const processedItems = validateNonNull(
      this.processedItemList,
      'ProcessedItems list missing',
    );
    const unprocessedItems = validateNonNull(
      this.unprocessedItemList,
      'UnprocessedItems list missing',
    );
    const failedItems = validateNonNull(
      this.failedItemList,
      'FailedItems list missing',
    );

    await this.firstTry(
      processors,
      method,
      aggregators,
      filters,
      processedItems,
      unprocessedItems,
      failedItems,
    );

    await this.secondTry(
      unprocessedItems,
      processors,
      method,
      aggregators,
      processedItems,
      failedItems,
    );
  }

  private async firstTry(
    processors: Processor[],
    method: Method<T>,
    aggregators: Aggregator[],
    filters: Filter[],
    processedItems: T[],
    unprocessedItems: T[],
    failedItems: EntityWithMetadata<T>[],
  ): Promise<void> {
    for await (const item of this.consumeIterators()) {
      getLogger().info(
        `Worker load next item with externalId: ${item.externalId}`,
      );
      try {
        const unprocessedItem = _.cloneDeep(item);

        const shouldProcess = await this.filter(unprocessedItem, filters, method);
        if (shouldProcess) {
          const processedItem = await this.executeRunnable<T>(
            unprocessedItem,
            processors,
            method,
            true,
          );

          await this.executeRunnable<T>(processedItem, aggregators, method, true);

          processedItems.push(processedItem);
        } else {
          getLogger().info(`Worker filtered the item with externalId: ${item.externalId}`);
          processedItems.push(unprocessedItem);
        }
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
            unprocessedItems.push(item);
          })
          .any(() => {
            failedItems.push(this.generateFailedEntity(item, error as Error));
          })
          .with(error);
      }
    }
  }

  private async filter(
    item: T,
    filters: Filter[],
    method: Method<T>,
  ): Promise<boolean> {
    for (const filter of filters) {
      const shouldProcess = await method(filter, item, true);
      if (!shouldProcess) {
        return false;
      }
    }
    return true;
  }

  private async secondTry(
    unprocessedItems: T[],
    processors: Processor[],
    method: Method<T>,
    aggregators: Aggregator[],
    processedItems: T[],
    failedItems: EntityWithMetadata<T>[],
  ): Promise<void> {
    getLogger().debug(
      `Processing ${unprocessedItems.length} postponed items in worker`,
    );
    while (unprocessedItems.length > 0) {
      const item = unprocessedItems.shift()!;
      getLogger().info(
        `Worker load next postponed item with externalId: ${item.externalId}`,
      );

      let processedItem: T;
      try {
        const unprocessedItem = _.cloneDeep(item);
        processedItem = await this.executeRunnable<T>(
          unprocessedItem,
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
          `Error processing (unprocessed) item ${item.externalId}: ${error}`,
          error as Error,
        );
        await catcher()
          .on(Interrupted, (error) => {
            unprocessedItems.unshift(item);
            throw error;
          })
          .any(() => {
            failedItems.push(
              this.generateFailedEntity(processedItem || item, error as Error),
            );
          })
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

  private generateFailedEntity(item: T, error: Error): EntityWithMetadata<T> {
    if (error instanceof ErrorBasePublic) {
      return {
        ...item,
        errors: error.toFailedEntityErrors(),
      };
    }

    return {
      ...item,
      errors: [
        {
          code: ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR,
          messageWithParams: 'Unexpected error',
          messageParams: { error: error.message },
        },
      ],
    };
  }
}
