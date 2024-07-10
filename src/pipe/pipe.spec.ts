import { Pipe } from './pipe.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/sync-export-model.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Loader } from './loader.js';
import { ExternalContent } from '../model/external-content.js';
import { Processor } from '../processor/processor.js';
import { SyncableContents } from '../model/syncable-contents.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Configurer } from './configurer.js';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('Pipe', () => {
  let sourceAdapter: SourceAdapter<Category, Label, Document>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapterPair: AdapterPair<typeof sourceAdapter, typeof destinationAdapter>;

  beforeEach(() => {
    sourceAdapter = createSourceAdapter();
    destinationAdapter = new GenesysDestinationAdapter();
    adapterPair = {
      sourceAdapter,
      destinationAdapter,
    };
  });

  it('should execute all tasks in order', async () => {
    expect.assertions(1);

    const calls: string[] = [];
    const loaderMock = createLoaderMock(calls);
    const processorMock = createProcessorMock(calls);
    const aggregatorMock = createAggregatorMock(calls);
    const uploaderMock = createUploaderMock(calls);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(calls).toStrictEqual([
      'loader',
      'processor',
      'aggregator',
      'uploader',
    ]);
  });

  it('should initialize all adapters', async () => {
    expect.assertions(2);

    const loaderMock = createLoaderMock([]);
    const processorMock = createProcessorMock([]);
    const aggregatorMock = createAggregatorMock([]);
    const uploaderMock = createUploaderMock([]);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(sourceAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(destinationAdapter.initialize).toHaveBeenCalledTimes(1);
  });

  it('should initialize all tasks', async () => {
    expect.assertions(4);

    const loaderMock = createLoaderMock([]);
    const processorMock = createProcessorMock([]);
    const aggregatorMock = createAggregatorMock([]);
    const uploaderMock = createUploaderMock([]);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(loaderMock.initialize).toHaveBeenCalledTimes(1);
    expect(processorMock.initialize).toHaveBeenCalledTimes(1);
    expect(aggregatorMock.initialize).toHaveBeenCalledTimes(1);
    expect(uploaderMock.initialize).toHaveBeenCalledTimes(1);
  });

  describe('when killAfterLongRunningSeconds is set', () => {
    let mockExit: jest.Spied<(code?: number) => never>;

    beforeEach(() => {
      mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((_code?: number) => undefined as never);

      jest.useFakeTimers();
    });

    afterEach(() => {
      mockExit.mockRestore();
      jest.useRealTimers();
    });

    it('should stop the process after configured seconds', async () => {
      expect.assertions(1);

      const loaderMock = createLongRunningLoaderMock();

      await new Pipe().adapters(adapterPair).loaders(loaderMock).start({
        killAfterLongRunningSeconds: '2',
      });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('when configurer given', () => {
    it('should run configurer', async () => {
      expect.assertions(3);

      const calls: string[] = [];
      const loaderMock = createLoaderMock(calls);
      const processorMock = createProcessorMock(calls);
      const aggregatorMock = createAggregatorMock(calls);
      const uploaderMock = createUploaderMock(calls);

      const configurer: Configurer = (pipe: Pipe) => {
        pipe
          .source(sourceAdapter)
          .destination(destinationAdapter)
          .loaders(loaderMock)
          .processors(processorMock)
          .aggregator(aggregatorMock)
          .uploaders(uploaderMock);
      };

      await new Pipe().configurer(configurer).start({});

      expect(sourceAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(destinationAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(calls).toStrictEqual([
        'loader',
        'processor',
        'aggregator',
        'uploader',
      ]);
    });
  });

  function createSourceAdapter(): SourceAdapter<Category, Label, Document> {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      getAllCategories: jest.fn<() => Promise<Category[]>>(),

      getAllLabels: jest.fn<() => Promise<Label[]>>(),

      getAllArticles: jest.fn<() => Promise<Document[]>>(),

      extractDocumentIdFromUrl:
        jest.fn<
          (
            articleLookupTable: Map<string, string>,
            hyperlink: string | null,
          ) => string | undefined
        >(),
    };
  }

  function createLoaderMock(calls: string[]): Loader {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ExternalContent | undefined) => {
        calls.push('loader');
        return {} as ExternalContent;
      },
    } as Loader;
  }

  function createProcessorMock(calls: string[]): Processor {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ExternalContent) => {
        calls.push('processor');
        return {} as ExternalContent;
      },
    };
  }

  function createAggregatorMock(calls: string[]): Aggregator {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ExternalContent) => {
        calls.push('aggregator');
        return {} as SyncableContents;
      },
    };
  }

  function createUploaderMock(calls: string[]): Uploader {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: SyncableContents) => {
        calls.push('uploader');
      },
    };
  }

  function createLongRunningLoaderMock(): Loader {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ExternalContent | undefined) => {
        // resolve after 3000ms
        return new Promise((resolve) => {
          setTimeout(() => resolve({} as ExternalContent), 3000);
          jest.advanceTimersByTime(2000);
          jest.runAllTicks();
          jest.runAllTimers();
        });
      },
    } as Loader;
  }
});
