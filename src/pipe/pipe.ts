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
import { HookEvent } from './hook-callback.js';
import { Category, Document, ExternalContent, Label } from '../model';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { extractLinkBlocksFromVariation } from '../utils/link-object-extractor.js';
import { PrefixExternalIdConfig } from '../processor/prefix-external-id/prefix-external-id-config.js';
import { PipeContext } from './pipe-context.js';
import { ContextRepository } from '../context/context-repository.js';
import { TimerConfig } from './timer-config.js';
import { Interrupted } from '../utils/errors/interrupted.js';
import { Worker } from './worker.js';
import { runtime } from '../utils/runtime.js';
import { catcher } from '../utils/catch-error-helper.js';

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
  private contextRepositoryList: ContextRepository[] = [];
  private context: PipeContext | null = null;

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
    runtime.hooks(eventName, callback);
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

      this.context = await this.initialize(config);

      await this.processCategories(this.context);
      await this.processLabels(this.context);
      await this.processDocuments(this.context);

      runtime.stopProcessKillTimer(); // Do not stop process in middle of upload
      await this.uploadResult(config, this.context);

      await this.saveContext();
    } catch (error) {
      await catcher()
        .on(Interrupted, async () => {
          getLogger().info('Interrupted.');
          await runtime.triggerEvent(HookEvent.ON_TIMEOUT);
          await this.saveContext();
        })
        .with(error);
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;
      getLogger().info(`Process took ${duration} milliseconds.`);

      runtime.stopProcessKillTimer();
    }
  }

  private async uploadResult(
    config: PrefixExternalIdConfig,
    context: PipeContext,
  ): Promise<void> {
    await this.initTasks(this.uploaderList, config, context);
    await this.executeUploaders(context.syncableContents);
  }

  private async processDocuments(context: PipeContext): Promise<void> {
    await new Worker()
      .iterators(() => this.loaderList.map((l) => l.documentIterator()))
      .processors(this.processorList)
      .aggregators(this.aggregatorList)
      .processedItems(context.pipe.processedItems.documents)
      .unprocessedItems(context.pipe.unprocessedItems.documents)
      .failedItems(context.pipe.failedItems.documents)
      .method(
        async (runnable, item, firstTry: boolean) =>
          (await runnable.runOnDocument(
            item as Document,
            firstTry,
          )) as Document,
      )
      .execute();
  }

  private async processLabels(context: PipeContext): Promise<void> {
    await new Worker()
      .iterators(() => this.loaderList.map((l) => l.labelIterator()))
      .processors(this.processorList)
      .aggregators(this.aggregatorList)
      .processedItems(context.pipe.processedItems.labels)
      .unprocessedItems(context.pipe.unprocessedItems.labels)
      .failedItems(context.pipe.failedItems.labels)
      .method(
        async (runnable, item, firstTry: boolean) =>
          (await runnable.runOnLabel(item as Label, firstTry)) as Label,
      )
      .execute();
  }

  private async processCategories(context: PipeContext): Promise<void> {
    await new Worker()
      .iterators(() => this.loaderList.map((l) => l.categoryIterator()))
      .processors(this.processorList)
      .aggregators(this.aggregatorList)
      .processedItems(context.pipe.processedItems.categories)
      .unprocessedItems(context.pipe.unprocessedItems.categories)
      .failedItems(context.pipe.failedItems.categories)
      .method(
        async (runnable, item, firstTry: boolean) =>
          (await runnable.runOnCategory(
            item as Category,
            firstTry,
          )) as Category,
      )
      .execute();
  }

  private async initialize(config: PrefixExternalIdConfig) {
    await this.destinationAdapter!.initialize(config);

    let context = await this.loadContext();
    if (!context) {
      context = await this.createContext(this.destinationAdapter!);
    }

    await this.sourceAdapter!.initialize(config, context!);

    await this.initTasks(this.loaderList, config, context);
    await this.initTasks(this.processorList, config, context);
    await this.initTasks(this.aggregatorList, config, context);

    return context;
  }

  private startProcessKillTimer(config: TimerConfig): void {
    if (!config?.killAfterLongRunningSeconds) {
      return;
    }

    const lifetimeInSeconds = parseInt(config?.killAfterLongRunningSeconds, 10);
    runtime.setProcessKillTimer(lifetimeInSeconds);
  }

  private async executeUploaders(
    importableContents: SyncableContents,
  ): Promise<void> {
    for (const uploader of this.uploaderList) {
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
    return await wrapFunction(
      () => method(item),
      `Error executing ${task.constructor.name}`,
    );
  }

  private async initTasks(
    taskList: Task[],
    config: Config,
    context: PipeContext,
  ): Promise<void> {
    await Promise.all(taskList.map((t) => this.initTask(t, config, context)));
  }

  private async initTask(
    task: Task,
    config: Config,
    context: PipeContext,
  ): Promise<void> {
    getLogger().info(`${task.constructor.name} task init`);
    await wrapFunction(
      () =>
        task.initialize(
          config,
          {
            sourceAdapter: this.sourceAdapter!,
            destinationAdapter: this.destinationAdapter!,
          },
          context,
        ),
      `Error initializing ${task.constructor.name}`,
    );
    getLogger().info(`${task.constructor.name} task init finished`);
  }

  private async loadContext(): Promise<PipeContext | null> {
    if (this.contextRepositoryList.length > 0) {
      const [repository] = this.contextRepositoryList;

      if (await repository.exists()) {
        return await repository.load();
      }
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
        failedItems: {
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
      categoryLookupTable: {},
      labelLookupTable: {},
      articleLookupTable: {},
    };
  }
}
