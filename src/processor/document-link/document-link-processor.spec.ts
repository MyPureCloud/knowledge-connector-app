import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DocumentLinkProcessor } from './document-link-processor.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import { Config } from '../../config.js';
import { ExportModel, SyncModel } from '../../model/sync-export-model.js';
import { Document } from '../../model/document.js';
import { Image } from '../../model/image.js';
import { SyncDataResponse } from '../../model/sync-data-response.js';
import { BulkDeleteResponse } from '../../model/bulk-delete-response.js';
import { ExternalLink } from '../../model/external-link.js';
import { generateDocumentWithLinkedDocuments } from '../../tests/utils/entity-generators.js';

describe('DocumentLinkProcessor', function () {
  let linkProcessor: DocumentLinkProcessor;
  let sourceAdapter: SourceAdapter<unknown, unknown, unknown>;
  let adapters: AdapterPair<
    SourceAdapter<unknown, unknown, unknown>,
    DestinationAdapter
  >;
  let mockGetDocumentLinkMatcherRegexp: jest.Mock<() => RegExp | undefined>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
      getAllCategories: jest.fn<() => Promise<unknown[]>>(),
      getAllLabels: jest.fn<() => Promise<unknown[]>>(),
      getAllArticles: jest.fn<() => Promise<unknown[]>>(),
      getDocumentLinkMatcherRegexp: jest.fn<() => RegExp | undefined>(),
      getResourceBaseUrl: jest.fn<() => string>(),
    };

    mockGetDocumentLinkMatcherRegexp =
      sourceAdapter.getDocumentLinkMatcherRegexp as jest.Mock<
        () => RegExp | undefined
      >;

    mockGetDocumentLinkMatcherRegexp.mockReturnValue(
      /sysparm_article=([A-Za-z0-9]+)/,
    );

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

    await linkProcessor.initialize({ updateDocumentLinks: 'true' }, adapters);
  });

  it('should replace hyperlink field with externalDocumentId for linked doc text block', async function () {
    const externalId = 'some-external-id';
    const result = await linkProcessor.run({
      categories: [],
      labels: [],
      documents: [generateDocumentWithLinkedDocuments('1')],
      articleLookupTable: new Map<string, ExternalLink>([
        ['KB0012439', { externalDocumentId: externalId }],
      ]),
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
