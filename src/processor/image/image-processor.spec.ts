import { AdapterPair } from '../../adapter/adapter-pair.js';
import { ImageProcessor } from './image-processor.js';
import { ImageSourceAdapter } from '../../adapter/image-source-adapter.js';
import { GenesysDestinationAdapter } from '../../genesys/genesys-destination-adapter.js';
import {
  generateDocumentWithTable,
  generateNormalizedDocument,
} from '../../tests/utils/entity-generators.js';
import { Image } from '../../model/image.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AttachmentDomainNotAllowedError } from '../attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { Document } from '../../model';

jest.mock('../../utils/web-client.js');
jest.mock('../../genesys/genesys-destination-adapter.js');

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
          generateNormalizedDocument('1'),
          generateNormalizedDocument('2'),
          generateNormalizedDocument('3'),
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
        documents: [generateDocumentWithTable('1')],
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[1].table
          ?.rows[0].cells[0].blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
      expect(
        result.documents[0].published?.variations[0].body?.blocks[1].table
          ?.rows[1].cells[0].blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
    });

    it('should not replace image block urls if adapter.getAttachment throws domain not allowed error', async () => {
      mockGetAttachment.mockRejectedValue(
        new AttachmentDomainNotAllowedError('https://attachment-url'),
      );

      const result = await imageProcessor.run({
        categories: [],
        labels: [],
        documents: [generateNormalizedDocument('1')],
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[0].image?.url,
      ).toBe('https://document-image.url');
    });

    it('should propagate other adapter.getAttachment errors', async () => {
      mockGetAttachment.mockRejectedValue(
        new Error('something unexpected happened'),
      );

      await expect(
        imageProcessor.run({
          categories: [],
          labels: [],
          documents: [generateNormalizedDocument('1')],
        }),
      ).rejects.toThrow('something unexpected happened');
    });

    it('should download images with relative urls from allowed domains', async () => {
      const config = {
        relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
        attachmentDomainAllowList: 'api-cdn.usw2.pure.cloud',
      };
      imageProcessor = new ImageProcessor();
      await imageProcessor.initialize(config, adapters);
      mockGetAttachment.mockResolvedValue(null);
      const documents = [generateNormalizedDocument('1')];
      documents[0].published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.jpg';

      const result = await imageProcessor.run({
        categories: [],
        labels: [],
        documents,
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
    });

    it('should not download images with relative urls from not allowed domains', async () => {
      const config = {
        relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
        attachmentDomainAllowList: 'api-cdn.mypurecloud.com',
      };
      imageProcessor = new ImageProcessor();
      await imageProcessor.initialize(config, adapters);
      mockGetAttachment.mockResolvedValue(null);
      const documents = [generateNormalizedDocument('1')];
      documents[0].published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.jpg';

      const result = await imageProcessor.run({
        categories: [],
        labels: [],
        documents,
      });

      expect(
        result.documents[0].published?.variations[0].body?.blocks[0].image?.url,
      ).toBe('relative-image.jpg');
    });
  });

  describe('when disableImageUpload is true', () => {
    let documents: Document[];
    beforeEach(async () => {
      documents = [generateNormalizedDocument('1')];
      documents[0].published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.png';
    });

    describe('when relativeImageBaseUrl is empty', () => {
      beforeEach(async () => {
        await imageProcessor.initialize(
          {
            disableImageUpload: 'true',
          },
          adapters,
        );
      });

      it('should do nothing', async () => {
        const result = await imageProcessor.run({
          categories: [],
          labels: [],
          documents,
        });

        expect(
          result.documents[0].published?.variations[0].body?.blocks[0].image
            ?.url,
        ).toBe('relative-image.png');
        expect(mockGetAttachment).not.toHaveBeenCalled();
      });
    });

    describe('when relativeImageBaseUrl is set', () => {
      beforeEach(async () => {
        await imageProcessor.initialize(
          {
            disableImageUpload: 'true',
            relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
          },
          adapters,
        );
      });

      it('should extend relative image URLs', async () => {
        const result = await imageProcessor.run({
          categories: [],
          labels: [],
          documents,
        });

        expect(
          result.documents[0].published?.variations[0].body?.blocks[0].image
            ?.url,
        ).toBe('https://api-cdn.usw2.pure.cloud/relative-image.png');
        expect(mockGetAttachment).not.toHaveBeenCalled();
      });
    });
  });
});
