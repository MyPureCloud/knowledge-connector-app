import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DocumentLinkProcessor } from './document-link-processor.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { Config } from '../config';
import {
  BulkDeleteResponse,
  Document,
  ExportModel,
  Image,
  SyncDataResponse,
  SyncModel,
} from '../model';
import { generateDocumentWithLinkedDocuments } from '../tests/utils/entity-generators';
import { ServiceNowAdapter } from '../servicenow';

describe('DocumentLinkProcessor', function () {
  let linkProcessor: DocumentLinkProcessor;
  let sourceAdapter: SourceAdapter<any, any, any>;
  let adapters: AdapterPair<SourceAdapter<any, any, any>, DestinationAdapter>;
  let mockGetDocumentLinkMatcherRegexp: jest.Mock<() => RegExp | undefined>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
      getAllCategories: jest.fn<() => Promise<any[]>>(),
      getAllLabels: jest.fn<() => Promise<any[]>>(),
      getAllArticles: jest.fn<() => Promise<any[]>>(),
      getDocumentLinkMatcherRegexp: jest.fn<() => RegExp | undefined>(),
    };

    mockGetDocumentLinkMatcherRegexp =
      sourceAdapter.getDocumentLinkMatcherRegexp as jest.Mock<
        () => RegExp | undefined
      >;

    const destinationAdapter: DestinationAdapter = {
      initialize: jest
        .fn<(config: Config) => Promise<void>>()
        .mockResolvedValue(),
      lookupImage: jest
        .fn<(hash: string) => Promise<string | null>>()
        .mockResolvedValue('mockImageId'),
      uploadImage: jest
        .fn<(hash: string, image: Image) => Promise<string | null>>()
        .mockResolvedValue('mockUploadId'),
      exportAllEntities: jest
        .fn<() => Promise<ExportModel>>()
        .mockResolvedValue({} as ExportModel),
      syncData: jest
        .fn<(data: SyncModel) => Promise<SyncDataResponse>>()
        .mockResolvedValue({} as SyncDataResponse),
      deleteArticles: jest
        .fn<(documents: Document[]) => Promise<BulkDeleteResponse[]>>()
        .mockResolvedValue([] as BulkDeleteResponse[]),
    };

    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    linkProcessor = new DocumentLinkProcessor();

    await linkProcessor.initialize({}, adapters);
  });

  it('should replace hyperlink field with externalDocumentId for linked doc text block', async function () {
    const externalId = 'some-external-id';
    mockGetDocumentLinkMatcherRegexp.mockReturnValue(
      /sysparm_article=([A-Za-z0-9]+)/,
    );
    const result = await linkProcessor.run({
      categories: [],
      labels: [],
      documents: [generateDocumentWithLinkedDocuments('1')],
      articleLookupTable: new Map<string, string>([['KB0012439', externalId]]),
    });

    const blocks =
      result.documents[0].published?.variations[0].body?.blocks ?? [];
    expect(blocks.length).toBe(4);
    expect(blocks[0].paragraph?.blocks[0].text?.hyperlink).toBeUndefined();
    expect(blocks[0].paragraph?.blocks[0].text?.externalDocumentId).toBe(
      externalId,
    );
    expect(blocks[1].list?.blocks[0].blocks[0].text?.hyperlink).toBeUndefined();
    expect(blocks[1].list?.blocks[0].blocks[0].text?.externalDocumentId).toBe(
      externalId,
    );
    expect(blocks[2].paragraph?.blocks[0].image?.hyperlink).toBeUndefined();
    expect(blocks[2].paragraph?.blocks[0].image?.externalDocumentId).toBe(
      externalId,
    );
    expect(
      blocks[3].table?.rows[0].cells[0].blocks[0].list?.blocks[0].blocks[0].text
        ?.hyperlink,
    ).toBeUndefined();
    expect(
      blocks[3].table?.rows[0].cells[0].blocks[0].list?.blocks[0].blocks[0].text
        ?.externalDocumentId,
    ).toBe(externalId);
    expect(
      blocks[3].table?.rows[0].cells[1].blocks[0].image?.hyperlink,
    ).toBeUndefined();
    expect(
      blocks[3].table?.rows[0].cells[1].blocks[0].image?.externalDocumentId,
    ).toBe(externalId);
  });
});
