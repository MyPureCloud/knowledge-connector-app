import { Pipe } from './pipe.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Loader } from './loader.js';
import { ExternalContent } from '../model/external-content.js';
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
import { HookEvent } from './hook-callback.js';
import { Processor } from '../processor/processor.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../tests/utils/entity-generators.js';
import { ExternalLink } from '../model/external-link.js';

jest.mock('../genesys/genesys-destination-adapter.js');

const mockCategoryIterator =
  jest.fn<() => AsyncGenerator<unknown, void, void>>();
const mockLabelIterator = jest.fn<() => AsyncGenerator<unknown, void, void>>();
const mockDocumentIterator =
  jest.fn<() => AsyncGenerator<unknown, void, void>>();

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

    mockCategoryIterator.mockImplementation(categoryIterator);
    mockLabelIterator.mockImplementation(labelIterator);
    mockDocumentIterator.mockImplementation(documentIterator);
  });

  it('should execute all tasks in order', async () => {
    expect.assertions(1);

    const calls: string[] = [];
    const loaderMock = createLoaderMock();
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
      'processor',
      'aggregator',
      'processor',
      'aggregator',
      'processor',
      'aggregator',
      'uploader',
    ]);
  }, 10000); // TODO: revert

  it('should initialize all adapters', async () => {
    expect.assertions(2);

    const loaderMock = createLoaderMock();
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
  }, 10000); // TODO: revert

  it('should initialize all tasks', async () => {
    expect.assertions(4);

    const loaderMock = createLoaderMock();
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
  }, 10000); // TODO: revert

  describe.skip('when killAfterLongRunningSeconds is set', () => {
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

    describe('when ON_TIMEOUT hook callback is registered', () => {
      it('should call hook callback before killing process', async () => {
        expect.assertions(2);

        const loaderMock = createLongRunningLoaderMock();
        const hook = async () => {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              expect(true).toBe(true);
              resolve();
            }, 100);
          });
        };

        await new Pipe()
          .adapters(adapterPair)
          .loaders(loaderMock)
          .hooks(HookEvent.ON_TIMEOUT, hook)
          .start({
            killAfterLongRunningSeconds: '2',
          });

        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('when configurer given', () => {
    it('should run configurer', async () => {
      expect.assertions(3);

      const calls: string[] = [];
      const loaderMock = createLoaderMock();
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
        'processor',
        'aggregator',
        'processor',
        'aggregator',
        'processor',
        'aggregator',
        'uploader',
      ]);
    }, 10000); // TODO: revert
  });

  describe.skip('when export contains generated fields', () => {
    // let context: Context<unknown, unknown, unknown>;

    beforeEach(() => {
      // context = {
      //   storedContent: {
      //     categories: [],
      //     labels: [],
      //     documents: [
      //       generateNormalizedDocumentWithInternalDocumentLinks(
      //         '-1',
      //         'https://modified.url/article/123',
      //       ),
      //     ],
      //   },
      // } as unknown as Context<unknown, unknown, unknown>;
    });

    it('should remove generated content and thus not detect change', async () => {
      // await aggregator.runOnDocument(
      //   generateNormalizedDocumentWithInternalDocumentLinks('-1', undefined),
      // );
      //
      // expect(context.syncableContents.documents.created.length).toBe(0);
      // expect(context.syncableContents.documents.updated.length).toBe(0);
      // expect(context.syncableContents.documents.deleted.length).toBe(0);
    });
  });

  function createSourceAdapter(): SourceAdapter<Category, Label, Document> {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      categoryIterator: jest.fn<() => AsyncGenerator<Category, void, void>>(),

      labelIterator: jest.fn<() => AsyncGenerator<Label, void, void>>(),

      articleIterator: jest.fn<() => AsyncGenerator<Document, void, void>>(),

      getDocumentLinkMatcherRegexp: jest.fn<() => RegExp | undefined>(),

      getResourceBaseUrl: jest.fn<() => string>(),

      constructDocumentLink:
        jest.fn<(id: string) => Promise<ExternalLink | null>>(),
    };
  }

  function createLoaderMock(): Loader {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      categoryIterator: mockCategoryIterator,

      labelIterator: mockLabelIterator,

      documentIterator: mockDocumentIterator,
    } as Loader;
  }

  function createProcessorMock(calls: string[]): Processor {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      runOnCategory: async (_item: Category) => {
        calls.push('processor');
        return {} as Category;
      },
      runOnLabel: async (_item: Label) => {
        calls.push('processor');
        return {} as Label;
      },
      runOnDocument: async (_item: Document) => {
        calls.push('processor');
        return {} as Document;
      },
      getPriority(): number {
        return 0;
      },
    };
  }

  function createAggregatorMock(calls: string[]): Aggregator {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      runOnCategory: async (_item: Category) => {
        calls.push('aggregator');
      },
      runOnLabel: async (_item: Label) => {
        calls.push('aggregator');
      },
      runOnDocument: async (_item: Document) => {
        calls.push('aggregator');
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

      async *categoryIterator(): AsyncGenerator<Category, void, void> {},

      async *labelIterator(): AsyncGenerator<Label, void, void> {},

      async *documentIterator(): AsyncGenerator<Document, void, void> {},
    } as Loader;
  }
});

async function* categoryIterator(): AsyncGenerator<unknown, void, void> {
  yield generateNormalizedCategory('1');
}

async function* labelIterator(): AsyncGenerator<unknown, void, void> {
  yield generateNormalizedLabel('2');
}

async function* documentIterator(): AsyncGenerator<unknown, void, void> {
  yield generateNormalizedDocument('3');
}
