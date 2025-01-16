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
import {
  ARTICLE_LINK,
  generateDocumentWithLinkedDocuments,
  LINKED_ARTICLE_ID,
} from '../../tests/utils/entity-generators.js';
import { Category, Label } from '../../model';
import { PipeContext } from '../../pipe/pipe-context.js';
import { ExternalLink } from '../../model/external-link.js';
import { LinkBlock } from '../../model/link-block.js';

describe('DocumentLinkProcessor', function () {
  const EXTERNAL_ID = 'some-external-id';
  const OTHER_EXTERNAL_ID = 'other-external-id';
  const EXTERNAL_ID_ALTERNATIVE = 'external-id-alternative';
  const EXTERNAL_ID_PREFIX = 'external-id-prefix-';

  let linkProcessor: DocumentLinkProcessor;
  let sourceAdapter: SourceAdapter<unknown, unknown, unknown>;
  let adapters: AdapterPair<
    SourceAdapter<unknown, unknown, unknown>,
    DestinationAdapter
  >;
  let context: PipeContext;
  let mockGetDocumentLinkMatcherRegexp: jest.Mock<() => RegExp | undefined>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
      categoryIterator: jest.fn<() => AsyncGenerator<Category, void, void>>(),
      labelIterator: jest.fn<() => AsyncGenerator<Label, void, void>>(),
      articleIterator: jest.fn<() => AsyncGenerator<Document, void, void>>(),
      getDocumentLinkMatcherRegexp: jest.fn<() => RegExp | undefined>(),
      getResourceBaseUrl: jest.fn<() => string>(),
      constructDocumentLink:
        jest.fn<(id: string) => Promise<ExternalLink | null>>(),
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
  });

  describe('when linked article known', () => {
    beforeEach(async () => {
      context = {
        articleLookupTable: {
          [LINKED_ARTICLE_ID]: {
            externalDocumentId: EXTERNAL_ID,
            externalDocumentIdAlternatives: [EXTERNAL_ID_ALTERNATIVE],
          },
        },
        imageLookupTable: {},
      } as unknown as PipeContext;

      await linkProcessor.initialize(
        { updateDocumentLinks: 'true' },
        adapters,
        context,
      );
    });

    it('should replace hyperlink field with externalDocumentId for linked doc text block', async function () {
      const result = await linkProcessor.runOnDocument(
        generateDocumentWithLinkedDocuments('1'),
      );

      verifyDocumentLinks(result, undefined, EXTERNAL_ID, [
        EXTERNAL_ID_ALTERNATIVE,
      ]);
    });
  });

  describe('when linked article unknown', () => {
    beforeEach(async () => {
      context = {
        articleLookupTable: {
          [OTHER_EXTERNAL_ID]: {
            externalDocumentId: OTHER_EXTERNAL_ID,
            externalDocumentIdAlternatives: [EXTERNAL_ID_ALTERNATIVE],
          },
        },
        imageLookupTable: {},
      } as unknown as PipeContext;

      await linkProcessor.initialize(
        { updateDocumentLinks: 'true' },
        adapters,
        context,
      );
    });

    it('should fetch linked article data from source', async function () {
      sourceAdapter.constructDocumentLink = jest
        .fn<(id: string) => Promise<ExternalLink | null>>()
        .mockResolvedValue({
          externalDocumentId: OTHER_EXTERNAL_ID,
          externalDocumentIdAlternatives: [EXTERNAL_ID_ALTERNATIVE],
        });

      const result = await linkProcessor.runOnDocument(
        generateDocumentWithLinkedDocuments('1'),
        false,
      );

      verifyDocumentLinks(result, undefined, OTHER_EXTERNAL_ID, [
        EXTERNAL_ID_ALTERNATIVE,
      ]);
    });

    describe('when source fetch fails', () => {
      beforeEach(async () => {
        sourceAdapter.constructDocumentLink = jest
          .fn<(id: string) => Promise<ExternalLink | null>>()
          .mockResolvedValue(null);
      });

      it('should keep original link', async function () {
        const result = await linkProcessor.runOnDocument(
          generateDocumentWithLinkedDocuments('1'),
          false,
        );

        verifyDocumentLinks(result, ARTICLE_LINK, undefined, undefined);
      });
    });
  });

  describe('when externalIdPrefix defined', () => {
    beforeEach(async () => {
      await linkProcessor.initialize(
        { updateDocumentLinks: 'true', externalIdPrefix: EXTERNAL_ID_PREFIX },
        adapters,
        {
          articleLookupTable: {
            [LINKED_ARTICLE_ID]: { externalDocumentId: EXTERNAL_ID },
          },
        } as unknown as PipeContext,
      );
    });

    it('should use the externalIdPrefix', async function () {
      const result = await linkProcessor.runOnDocument(
        generateDocumentWithLinkedDocuments('1'),
      );

      verifyDocumentLinks(
        result,
        undefined,
        EXTERNAL_ID_PREFIX + EXTERNAL_ID,
        undefined,
      );
    });
  });

  function verifyDocumentLinks(
    result: Document,
    expectedHyperlink: string | undefined,
    expectedDocumentId: string | undefined,
    expectedDocumentIdAlternatives: string[] | undefined,
  ): void {
    const blocks = result.published?.variations[0].body?.blocks ?? [];
    expect(blocks.length).toBe(4);
    expect(blocks[0].paragraph?.blocks[0].text?.hyperlink).toBe(
      expectedHyperlink,
    );
    expect(blocks[0].paragraph?.blocks[0].text?.externalDocumentId).toBe(
      expectedDocumentId,
    );
    expect(
      (blocks[0].paragraph?.blocks[0].text as LinkBlock)
        .externalDocumentIdAlternatives,
    ).toEqual(expectedDocumentIdAlternatives);
    expect(blocks[1].list?.blocks[0].blocks[0].text?.hyperlink).toBe(
      expectedHyperlink,
    );
    expect(blocks[1].list?.blocks[0].blocks[0].text?.externalDocumentId).toBe(
      expectedDocumentId,
    );
    expect(
      (blocks[1].list?.blocks[0].blocks[0].text as LinkBlock)
        .externalDocumentIdAlternatives,
    ).toEqual(expectedDocumentIdAlternatives);
    expect(blocks[2].paragraph?.blocks[0].image?.hyperlink).toBe(
      expectedHyperlink,
    );
    expect(blocks[2].paragraph?.blocks[0].image?.externalDocumentId).toBe(
      expectedDocumentId,
    );
    expect(
      (blocks[2].paragraph?.blocks[0].image as LinkBlock)
        .externalDocumentIdAlternatives,
    ).toEqual(expectedDocumentIdAlternatives);
    expect(
      blocks[3].table?.rows[0].cells[0].blocks[0].list?.blocks[0].blocks[0].text
        ?.hyperlink,
    ).toBe(expectedHyperlink);
    expect(
      blocks[3].table?.rows[0].cells[0].blocks[0].list?.blocks[0].blocks[0].text
        ?.externalDocumentId,
    ).toBe(expectedDocumentId);
    expect(
      (
        blocks[3].table?.rows[0].cells[0].blocks[0].list?.blocks[0].blocks[0]
          .text as LinkBlock
      ).externalDocumentIdAlternatives,
    ).toEqual(expectedDocumentIdAlternatives);
    expect(blocks[3].table?.rows[0].cells[1].blocks[0].image?.hyperlink).toBe(
      expectedHyperlink,
    );
    expect(
      blocks[3].table?.rows[0].cells[1].blocks[0].image?.externalDocumentId,
    ).toBe(expectedDocumentId);
    expect(
      (blocks[3].table?.rows[0].cells[1].blocks[0].image as LinkBlock)
        .externalDocumentIdAlternatives,
    ).toEqual(expectedDocumentIdAlternatives);
  }
});
