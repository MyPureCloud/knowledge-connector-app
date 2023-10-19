import { Pipe } from './pipe.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/import-export-model.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Loader } from './loader.js';
import { ExternalContent } from '../model/external-content.js';
import { Processor } from '../processor/processor.js';
import { ImportableContents } from '../model/importable-contents.js';
import { Aggregator } from '../aggregator/aggregator.js';
import { Uploader } from '../uploader/uploader.js';

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

  function createSourceAdapter(): SourceAdapter<Category, Label, Document> {
    return {
      initialize: jest
        .fn<Promise<void>, any[], any>()
        .mockReturnValue(Promise.resolve()),

      getAllCategories: jest.fn<Promise<Category[]>, any[], any>(),

      getAllLabels: jest.fn<Promise<Label[]>, any[], any>(),

      getAllArticles: jest.fn<Promise<Document[]>, any[], any>(),
    };
  }

  function createLoaderMock(calls: string[]): Loader {
    return {
      initialize: jest
        .fn<Promise<void>, any[], any>()
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
        .fn<Promise<void>, any[], any>()
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
        .fn<Promise<void>, any[], any>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ExternalContent) => {
        calls.push('aggregator');
        return {} as ImportableContents;
      },
    };
  }

  function createUploaderMock(calls: string[]): Uploader {
    return {
      initialize: jest
        .fn<Promise<void>, any[], any>()
        .mockReturnValue(Promise.resolve()),

      run: async (_input: ImportableContents) => {
        calls.push('uploader');
      },
    };
  }
});
