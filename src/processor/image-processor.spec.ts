import { AdapterPair } from '../adapter/adapter-pair.js';
import { ImageProcessor } from './image-processor.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { generateDocument, generateDocumentWithTable } from '../tests/utils/entity-generators.js';
import { Image } from '../model/image.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../utils/web-client.js');
jest.mock('../genesys/genesys-destination-adapter.js');

describe('ImageProcessor', () => {
  let sourceAdapter: ImageSourceAdapter;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<ImageSourceAdapter, GenesysDestinationAdapter>;
  let imageProcessor: ImageProcessor;
  let mockGetAttachment: jest.Mock<() => Promise<Image | null>>;
  let mockLookupImage: jest.Mock<() => Promise<string | null>>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
      getAttachment: jest.fn<() => Promise<Image | null>>(),
    };
    mockGetAttachment = sourceAdapter.getAttachment as jest.Mock<
      () => Promise<Image | null>
    >;

    destinationAdapter = new GenesysDestinationAdapter();
    mockLookupImage = destinationAdapter.lookupImage as jest.Mock<
      () => Promise<string | null>
    >;

    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    imageProcessor = new ImageProcessor();

    await imageProcessor.initialize({}, adapters);
  });

  describe('run', () => {
    beforeEach(() => {
      mockGetAttachment.mockResolvedValue({
        url: 'https://attachment-url',
        name: '',
        contentType: 'image/png',
        content: new Blob([]),
      });
      mockLookupImage.mockResolvedValue('https://api.mypurecloud.com/image');
    });

    it('should replace all image block urls', async () => {
      const result = await imageProcessor.run({
        categories: [],
        labels: [],
        documents: [
          generateDocument('1'),
          generateDocument('2'),
          generateDocument('3'),
        ],
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
    });

    it('should replace all image block urls within a table', async () => {
      const result = await imageProcessor.run({
        categories: [],
        labels: [],
        documents: [
          generateDocumentWithTable('1'),
        ],
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[1].table?.rows[0].cells[0].blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
      expect(
        result.documents[0].published?.variations[0].body?.blocks[1].table?.rows[1].cells[0].blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
    });
  });
});
