import { Loader } from './loader.js';
import { ExternalContent } from '../model/external-content.js';
import { Processor } from '../processor/processor.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';
import { Config } from '../config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { SyncableContents } from '../model/syncable-contents.js';
import wrapFunction from '../utils/wrap-function.js';
import { Task } from './task.js';
import { TimerConfig } from './timer-config.js';
import { Configurer } from './configurer.js';
import { getLogger } from '../utils/logger.js';

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
  private sourceAdapter: Adapter | undefined;
  private destinationAdapter: Adapter | undefined;
  private loaderList: Loader[] = [];
  private processorList: Processor[] = [];
  private aggregatorList: Aggregator[] = [];
  private uploaderList: Uploader[] = [];

  /**
   * Define source and destination adapters
   * @param {AdapterPair<Adapter, Adapter>} adapters
   */
  public adapters(adapters: AdapterPair<Adapter, Adapter>) {
    this.sourceAdapter = adapters.sourceAdapter;
    this.destinationAdapter = adapters.destinationAdapter;
    return this;
  }

  /**
   * Define source adapter
   * @param {Adapter} sourceAdapter
   */
  public source(sourceAdapter: Adapter) {
    this.sourceAdapter = sourceAdapter;
    return this;
  }

  /**
   * Define destination adapter
   * @param {Adapter} destinationAdapter
   */
  public destination(destinationAdapter: Adapter) {
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
    this.processorList.push(...processors);
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

  public configurer(configurer: Configurer): Pipe {
    configurer(this);
    return this;
  }

  /**
   * Execute the defined tasks
   * @param {Config} config
   */
  public async start(config: Config): Promise<void> {
    const startTime = Date.now();
    const killTimer = this.startProcessKillTimer(config);

    try {
      validateNonNull(this.sourceAdapter, 'Missing source adapter');
      validateNonNull(this.destinationAdapter, 'Missing destination adapter');

      getLogger().info('Started');
      await Promise.all([
        this.sourceAdapter!.initialize(config),
        this.destinationAdapter!.initialize(config),
      ]);

      let externalContent = await this.executeLoaders(config);

      if (!externalContent) {
        getLogger().warn('Loaders returned no data');
        return;
      }

      externalContent = await this.executeProcessors(config, externalContent);

      const importableContents = await this.executeAggregators(
        config,
        this.createEmptyImportableContents(),
        externalContent,
      );

      await this.executeUploaders(config, importableContents);
      const endTime = Date.now();
      const duration = endTime - startTime;
      getLogger().info(`Process took ${duration} milliseconds.`);
    } finally {
      if (killTimer) {
        clearTimeout(killTimer);
      }
    }
  }

  private startProcessKillTimer(config: TimerConfig): NodeJS.Timeout | null {
    if (!config?.killAfterLongRunningSeconds) {
      return null;
    }
    const lifetimeInSeconds = parseInt(config?.killAfterLongRunningSeconds, 10);
    return setTimeout(() => {
      getLogger().error(
        `Connector app did not finish in [${lifetimeInSeconds}] seconds. Killing process`,
      );
      process.exit(1);
    }, lifetimeInSeconds * 1000);
  }

  private async executeLoaders(
    config: Config,
  ): Promise<ExternalContent | undefined> {
    let externalContent: ExternalContent | undefined = undefined;
    for (const loader of this.loaderList) {
      externalContent = await this.execute(loader, config, externalContent);
    }
    return externalContent;
  }

  private async executeProcessors(
    config: Config,
    externalContent: ExternalContent,
  ): Promise<ExternalContent> {
    for (const processor of this.processorList) {
      externalContent = await this.execute(processor, config, externalContent);
    }
    return externalContent;
  }

  private async executeAggregators(
    config: Config,
    importableContents: SyncableContents,
    externalContent: ExternalContent,
  ): Promise<SyncableContents> {
    for (const aggregator of this.aggregatorList) {
      importableContents = await this.execute(
        aggregator,
        config,
        externalContent,
      );
    }
    return importableContents;
  }

  private async executeUploaders(
    config: Config,
    importableContents: SyncableContents,
  ): Promise<void> {
    for (const uploader of this.uploaderList) {
      await this.execute(uploader, config, importableContents);
    }
  }

  private async execute<I, O>(
    task: Task<I, O>,
    config: Config,
    externalContent: I,
  ): Promise<O> {
    getLogger().info(`${task.constructor.name} task running`);
    await wrapFunction(
      () =>
        task.initialize(config, {
          sourceAdapter: this.sourceAdapter!,
          destinationAdapter: this.destinationAdapter!,
        }),
      `Error initializing ${task.constructor.name}`,
    );

    const result = await wrapFunction(
      () => task.run(externalContent),
      `Error executing ${task.constructor.name}`,
    );
    getLogger().info(`${task.constructor.name} task finished`);
    return result;
  }

  private createEmptyImportableContents(): SyncableContents {
    return {
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
    };
  }
}
