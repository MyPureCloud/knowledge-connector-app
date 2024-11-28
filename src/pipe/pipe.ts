import { Loader } from './loader.js';
import { Processor } from '../processor/processor.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';
import { Config } from '../config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { SyncableContents } from '../model/syncable-contents.js';
import wrapFunction from '../utils/wrap-function.js';
import { Task } from './task.js';
import { Configurer } from './configurer.js';
import { getLogger } from '../utils/logger.js';
import { HookCallback, HookEvent } from './hook-callback.js';
import {
  Category,
  Document,
  ExternalContent,
  ExternalIdentifiable,
  Label,
} from '../model';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { extractLinkBlocksFromVariation } from '../utils/link-object-extractor.js';
import { PrefixExternalIdConfig } from '../processor/prefix-external-id/prefix-external-id-config.js';
import { TransformationError } from '../utils/errors/transformation-error.js';
import { Runnable } from './runnable.js';
import { PipeContext } from './pipe-context.js';
import { ContextRepository } from '../context/context-repository.js';
import { TimerConfig } from './timer-config.js';
import { Interrupted } from '../utils/errors/interrupted.js';

type Iterators = 'categoryIterator' | 'labelIterator' | 'documentIterator';
type Methods = 'runOnCategory' | 'runOnLabel' | 'runOnDocument';

/**
 * Pipe is the collection of tasks and adapters which can be executed to do the sync from source to destination.
 * See also:
 *    {@link Adapter}
 *    {@link Loader}
 *    {@link Processor}
 *    {@link Aggregator}
 *    {@link Uploader}
 */
export class Pipe {
  private sourceAdapter: SourceAdapter<unknown, unknown, unknown> | undefined;
  private destinationAdapter: DestinationAdapter | undefined;
  private loaderList: Loader[] = [];
  private processorList: Processor[] = [];
  private aggregatorList: Aggregator[] = [];
  private uploaderList: Uploader[] = [];
  private hookMap: Map<HookEvent, HookCallback[]> = new Map();
  private contextRepositoryList: ContextRepository[] = [];
  private context: PipeContext | null = null;
  private interrupted: boolean = false;
  private processKillTimer: NodeJS.Timeout | null = null;

  /**
   * Define source and destination adapters
   * @param {AdapterPair<Adapter, Adapter>} adapters
   */
  public adapters(
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
  ) {
    this.sourceAdapter = adapters.sourceAdapter;
    this.destinationAdapter = adapters.destinationAdapter;
    return this;
  }

  /**
   * Define source adapter
   * @param {Adapter} sourceAdapter
   */
  public source(sourceAdapter: SourceAdapter<unknown, unknown, unknown>) {
    this.sourceAdapter = sourceAdapter;
    return this;
  }

  /**
   * Define destination adapter
   * @param {Adapter} destinationAdapter
   */
  public destination(destinationAdapter: DestinationAdapter) {
    this.destinationAdapter = destinationAdapter;
    return this;
  }

  /**
   * Define loader tasks
   * @param {Loader[]} loaders
   */
  public loaders(...loaders: Loader[]): Pipe {
    this.loaderList.push(...loaders);
    return this;
  }

  /**
   * Define processor tasks
   * @param {Processor[]} processors
   */
  public processors(...processors: Processor[]): Pipe {
    processors.forEach((p) => {
      let pos;
      for (pos = 0; pos < this.processorList.length; pos++) {
        if (this.processorList[pos].getPriority() < p.getPriority()) {
          break;
        }
      }
      this.processorList.splice(pos, 0, p);
    });
    return this;
  }

  /**
   * Define aggregator task
   * @param {Aggregator} aggregator
   */
  public aggregator(aggregator: Aggregator): Pipe {
    this.aggregatorList = [aggregator];
    return this;
  }

  /**
   * Define uploader tasks
   * @param {Uploader[]} uploaders
   */
  public uploaders(...uploaders: Uploader[]): Pipe {
    this.uploaderList.push(...uploaders);
    return this;
  }

  /**
   * Define single uploader task
   * @param {Uploader} uploader
   */
  public uploader(uploader: Uploader): Pipe {
    this.uploaderList = [uploader];
    return this;
  }

  /**
   * Apply configuration
   * @param {Configurer} configurer
   */
  public configurer(configurer: Configurer): Pipe {
    configurer(this);
    return this;
  }

  /**
   * Register hook callbacks
   * @param {HookEvent} eventName
   * @param {Function} callback
   */
  public hooks(eventName: HookEvent, callback: () => Promise<void>): Pipe {
    let callbacks = this.hookMap.get(eventName);
    if (!callbacks) {
      callbacks = [];
      this.hookMap.set(eventName, callbacks);
    }

    callbacks.push({
      eventName,
      callback,
    });
    return this;
  }

  /**
   * Register context repository
   * @param {ContextRepository} repository
   */
  public contextRepository(repository: ContextRepository): Pipe {
    this.contextRepositoryList = [repository];
    return this;
  }

  /**
   * Execute the defined tasks
   * @param {Config} config
   */
  public async start(config: PrefixExternalIdConfig): Promise<void> {
    const startTime = Date.now();
    this.startProcessKillTimer(config);

    try {
      validateNonNull(this.sourceAdapter, 'Missing source adapter');
      validateNonNull(this.destinationAdapter, 'Missing destination adapter');

      getLogger().info('Started');

      await this.destinationAdapter!.initialize(config);

      this.context = await this.loadContext();
      if (!this.context) {
        this.context = await this.createContext(this.destinationAdapter!);
      }

      await this.sourceAdapter!.initialize(config, this.context!);

      await this.initTasks(this.loaderList, config);
      await this.initTasks(this.processorList, config);
      await this.initTasks(this.aggregatorList, config);

      await this.processItems<Category>(
        'categoryIterator',
        'runOnCategory',
        this.context.pipe.processedItems.categories,
        this.context.pipe.unprocessedItems.categories,
      );

      await this.processItems<Label>(
        'labelIterator',
        'runOnLabel',
        this.context.pipe.processedItems.labels,
        this.context.pipe.unprocessedItems.labels,
      );

      await this.processItems<Document>(
        'documentIterator',
        'runOnDocument',
        this.context.pipe.processedItems.documents,
        this.context.pipe.unprocessedItems.documents,
      );

      this.stopProcessKillTimer(); // Do not stop process in middle of upload
      await this.initTasks(this.uploaderList, config);
      await this.executeUploaders(this.context.syncableContents);
      await this.saveContext();
    } catch (error) {
      if (error instanceof Interrupted) {
        getLogger().info('Interrupted.');
        await this.saveContext();
      }
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;
      getLogger().info(`Process took ${duration} milliseconds.`);

      this.stopProcessKillTimer();
    }
  }

  private startProcessKillTimer(config: TimerConfig): void {
    if (!config?.killAfterLongRunningSeconds) {
      return;
    }

    const lifetimeInSeconds = parseInt(config?.killAfterLongRunningSeconds, 10);
    this.processKillTimer = setTimeout(
      () => this.onTimeout(lifetimeInSeconds),
      lifetimeInSeconds * 1000,
    );
  }

  private stopProcessKillTimer(): void {
    if (this.processKillTimer) {
      clearTimeout(this.processKillTimer);
    }
  }

  private async onTimeout(lifetimeInSeconds: number): Promise<void> {
    const hookCallbacks = this.hookMap.get(HookEvent.ON_TIMEOUT);
    if (hookCallbacks?.length) {
      for (const hook of hookCallbacks) {
        try {
          await hook.callback();
        } catch (error) {
          getLogger().error(`Error running ON_TIMEOUT callback - ${error}`);
        }
      }
    }

    getLogger().info(
      `Connector app did not finish in [${lifetimeInSeconds}] seconds. Stopping...`,
    );
    this.interrupted = true;
  }

  private async processItems<T extends ExternalIdentifiable>(
    iteratorName: Iterators,
    method: Methods,
    processedItems: T[],
    unprocessedItems: T[],
  ): Promise<void> {
    for await (let item of this.executeLoaders<T>(iteratorName)) {
      getLogger().info(`Pipe load next item with externalId: ${item.externalId}`); // TODO
      try {
        item = await this.executeRunnable<T>(item, this.processorList, method);

        await new Promise((resolve) => setTimeout(() => resolve(true), 2000)); // TODO: remove

        await this.executeRunnable<T>(item, this.aggregatorList, method);

        processedItems.push(item);
      } catch (error) {
        if (error instanceof TransformationError) {
          unprocessedItems.push(item);
        }
        getLogger().warn(
          `Error processing entity ${item.externalId}: ${error}`,
        );
        // TODO: push to errorList
      }
    }

    getLogger().debug(`executeLoaders finished ${iteratorName}`); // TODO
    while (unprocessedItems.length > 0) {
      this.checkInterruption();

      let item = unprocessedItems.shift();

      try {
        item = await this.executeRunnable<T>(item!, this.processorList, method);

        await this.executeRunnable<T>(item, this.aggregatorList, method);

        processedItems.push(item);
      } catch (error) {
        getLogger().warn(
          `Error processing entity ${item?.externalId}: ${error}`,
        );
        // TODO: push to errorList
      }
    }
  }

  private async *executeLoaders<T>(iteratorName: Iterators): AsyncGenerator<T> {
    for (const loader of this.loaderList) {
      for await (const item of loader[iteratorName]()) {
        yield item as T;

        getLogger().debug(`executeLoaders checkInterruption ${iteratorName}`); // TODO
        this.checkInterruption();
      }
      getLogger().debug('executeLoaders finished loader ${iteratorName}'); // TODO
    }
    getLogger().debug('executeLoaders finished all loader ${iteratorName}'); // TODO
  }

  private async executeRunnable<T>(
    item: T,
    runnableList: Runnable<unknown, unknown, unknown>[],
    method: Methods,
  ): Promise<T> {
    for (const runnable of runnableList) {
      const fn: (item: T) => Promise<T> = runnable[method].bind(runnable) as (
        item: T,
      ) => Promise<T>;

      item = await this.execute<T, T>(runnable, fn, item);
    }
    return item;
  }

  private async executeUploaders(
    importableContents: SyncableContents,
  ): Promise<void> {
    for (const uploader of this.uploaderList) {
      this.checkInterruption();

      await this.execute(
        uploader,
        (item) => uploader.run(item),
        importableContents,
      );
    }
  }

  private async execute<I, O>(
    task: Task,
    method: (item: I) => Promise<O>,
    item: I,
  ): Promise<O> {
    // getLogger().debug(`${task.constructor.name} task running`); // TODO

    const result = await wrapFunction(
      () => method(item),
      `Error executing ${task.constructor.name}`,
    );

    // getLogger().debug(`${task.constructor.name} task finished`); // TODO
    return result;
  }

  private async initTasks(taskList: Task[], config: Config): Promise<void> {
    await Promise.all(taskList.map((t) => this.initTask(t, config)));
  }

  private async initTask(task: Task, config: Config): Promise<void> {
    getLogger().info(`${task.constructor.name} task init`);
    await wrapFunction(
      () =>
        task.initialize(
          config,
          {
            sourceAdapter: this.sourceAdapter!,
            destinationAdapter: this.destinationAdapter!,
          },
          this.context!,
        ),
      `Error initializing ${task.constructor.name}`,
    );
    getLogger().info(`${task.constructor.name} task init finished`);
  }

  private async loadContext(): Promise<PipeContext | null> {
    getLogger().info('LOAD CONTEXT');
    if (this.contextRepositoryList.length > 0) {
      const [repository] = this.contextRepositoryList;

      return await repository.load();
    }

    return null;
  }

  private async createContext(
    destinationAdapter: DestinationAdapter,
  ): Promise<PipeContext> {
    const context = this.initContext();

    const exportResult = await destinationAdapter.exportAllEntities();
    context.storedContent = this.removeGeneratedContent(
      exportResult.importAction,
    );

    context.syncableContents.categories.deleted = [
      ...(context.storedContent.categories || []),
    ];
    context.syncableContents.labels.deleted = [
      ...(context.storedContent.labels || []),
    ];
    context.syncableContents.documents.deleted = [
      ...(context.storedContent.documents || []),
    ];

    context.pipe = {
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
    };

    return context;
  }

  private async saveContext(): Promise<void> {
    if (this.contextRepositoryList.length > 0) {
      getLogger().info('Saving context...');
      const [repository] = this.contextRepositoryList;
      await repository.save(this.context!);
    }
  }

  private removeGeneratedContent(content: ExternalContent): ExternalContent {
    content.documents?.forEach((document) => {
      [
        ...(document.published?.variations ?? []),
        ...(document.draft?.variations ?? []),
      ].forEach((variation) =>
        extractLinkBlocksFromVariation(variation).forEach((block) => {
          if (block.externalDocumentId) {
            delete block.hyperlink;
          }
        }),
      );
    });

    return content;
  }

  private checkInterruption(): void {
    if (this.interrupted) {
      getLogger().debug('Interrupted thrown'); // TODO
      throw new Interrupted();
    }
  }

  private initContext(): PipeContext {
    return {
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
}
