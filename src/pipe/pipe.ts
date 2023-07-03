import { Loader } from './loader.js';
import { ExternalContent } from '../model/external-content.js';
import { Processor } from '../processor/processor.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';
import { Config } from '../config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ImportableContents } from '../model/importable-contents.js';
import wrapFunction from '../utils/wrap-function.js';
import logger from '../utils/logger.js';
import { Task } from './task.js';

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
  private adapterPair?: AdapterPair<Adapter, Adapter>;
  private loaderList: Loader[] = [];
  private processorList: Processor[] = [];
  private aggregatorList: Aggregator[] = [];
  private uploaderList: Uploader[] = [];

  /**
   * Define source and destination adapters
   * @param {AdapterPair<Adapter, Adapter>} adapters
   */
  public adapters(adapters: AdapterPair<Adapter, Adapter>) {
    this.adapterPair = adapters;
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
   * Execute the defined tasks
   * @param {Config} config
   */
  public async start(config: Config): Promise<void> {
    validateNonNull(this.adapterPair, 'Missing adapters');
    validateNonNull(this.adapterPair!.sourceAdapter, 'Missing source adapter');
    validateNonNull(
      this.adapterPair!.destinationAdapter,
      'Missing destination adapter',
    );

    logger.info('Started');
    await Promise.all([
      this.adapterPair!.sourceAdapter.initialize(config),
      this.adapterPair!.destinationAdapter.initialize(config),
    ]);

    let externalContent = await this.executeLoaders(config);

    if (!externalContent) {
      logger.warn('Loaders returned no data');
      return;
    }

    externalContent = await this.executeProcessors(config, externalContent);

    const importableContents = await this.executeAggregators(
      config,
      this.createEmptyImportableContents(),
      externalContent,
    );

    await this.executeUploaders(config, importableContents);
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
    importableContents: ImportableContents,
    externalContent: ExternalContent,
  ): Promise<ImportableContents> {
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
    importableContents: ImportableContents,
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
    logger.info(`${task.constructor.name} task running`);
    await wrapFunction(
      () => task.initialize(config, this.adapterPair!),
      `Error initializing ${task.constructor.name}`,
    );

    const result = await wrapFunction(
      () => task.run(externalContent),
      `Error executing ${task.constructor.name}`,
    );
    logger.info(`${task.constructor.name} task finished`);
    return result;
  }

  private createEmptyImportableContents(): ImportableContents {
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
