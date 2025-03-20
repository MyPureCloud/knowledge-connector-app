import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Pipe } from './pipe.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Loader } from './loader.js';
import { SyncableContents } from '../model/syncable-contents.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';
import { Configurer } from './configurer.js';
import { Processor } from '../processor/processor.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../tests/utils/entity-generators.js';
import { ExternalLink } from '../model/external-link.js';
import { Filter } from '../filter/filter.js';

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
    const filterMock = createFilterMock(calls);
    const aggregatorMock = createAggregatorMock(calls);
    const uploaderMock = createUploaderMock(calls);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .filter(filterMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(calls).toStrictEqual([
      'filter',
      'processor',
      'aggregator',
      'filter',
      'processor',
      'aggregator',
      'filter',
      'processor',
      'aggregator',
      'uploader',
    ]);
  });

  it('should skip processor task when filter task returns false', async () => {
    expect.assertions(1);

    const calls: string[] = [];
    const loaderMock = createLoaderMock();
    const processorMock = createProcessorMock(calls);
    const filterMock = createFilterMock(calls, false);
    const aggregatorMock = createAggregatorMock(calls);
    const uploaderMock = createUploaderMock(calls);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .filter(filterMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(calls).toStrictEqual([
      'filter',
      'processor',
      'aggregator',
      'filter',
      'processor',
      'aggregator',
      'filter',
      'uploader',
    ]);
  });

  it('should initialize all adapters', async () => {
    expect.assertions(2);

    const loaderMock = createLoaderMock();
    const processorMock = createProcessorMock([]);
    const filterMock = createFilterMock([]);
    const aggregatorMock = createAggregatorMock([]);
    const uploaderMock = createUploaderMock([]);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .filter(filterMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(sourceAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(destinationAdapter.initialize).toHaveBeenCalledTimes(1);
  });

  it('should initialize all tasks', async () => {
    expect.assertions(5);

    const loaderMock = createLoaderMock();
    const processorMock = createProcessorMock([]);
    const filterMock = createFilterMock([]);
    const aggregatorMock = createAggregatorMock([]);
    const uploaderMock = createUploaderMock([]);

    await new Pipe()
      .adapters(adapterPair)
      .loaders(loaderMock)
      .processors(processorMock)
      .filter(filterMock)
      .aggregator(aggregatorMock)
      .uploaders(uploaderMock)
      .start({});

    expect(loaderMock.initialize).toHaveBeenCalledTimes(1);
    expect(processorMock.initialize).toHaveBeenCalledTimes(1);
    expect(filterMock.initialize).toHaveBeenCalledTimes(1);
    expect(aggregatorMock.initialize).toHaveBeenCalledTimes(1);
    expect(uploaderMock.initialize).toHaveBeenCalledTimes(1);
  });

  describe('when configurer given', () => {
    it('should run configurer', async () => {
      expect.assertions(3);

      const calls: string[] = [];
      const loaderMock = createLoaderMock();
      const processorMock = createProcessorMock(calls);
      const filterMock = createFilterMock(calls);
      const aggregatorMock = createAggregatorMock(calls);
      const uploaderMock = createUploaderMock(calls);

      const configurer: Configurer = (pipe: Pipe) => {
        pipe
          .source(sourceAdapter)
          .destination(destinationAdapter)
          .loaders(loaderMock)
          .processors(processorMock)
          .filter(filterMock)
          .aggregator(aggregatorMock)
          .uploaders(uploaderMock);
      };

      await new Pipe().configurer(configurer).start({});

      expect(sourceAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(destinationAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(calls).toStrictEqual([
        'filter',
        'processor',
        'aggregator',
        'filter',
        'processor',
        'aggregator',
        'filter',
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

  function createFilterMock(calls: string[], shouldProcess = true): Filter {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      runOnCategory: async (_item: Category) => {
        calls.push('filter');
        return true;
      },
      runOnLabel: async (_item: Label) => {
        calls.push('filter');
        return true;
      },
      runOnDocument: async (_item: Document) => {
        calls.push('filter');
        return shouldProcess;
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
