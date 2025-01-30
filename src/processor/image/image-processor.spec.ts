import { AdapterPair } from '../../adapter/adapter-pair.js';
import { ImageProcessor } from './image-processor.js';
import { ImageSourceAdapter } from '../../adapter/image-source-adapter.js';
import { GenesysDestinationAdapter } from '../../genesys/genesys-destination-adapter.js';
import {
  generateDocumentWithTable,
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../../tests/utils/entity-generators.js';
import { Image } from '../../model/image.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AttachmentDomainNotAllowedError } from '../attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { Document } from '../../model/document.js';
import { cloneDeep } from 'lodash';
import { PipeContext } from '../../pipe/pipe-context.js';

jest.mock('../../utils/package-version.js');
jest.mock('../../utils/web-client.js');
jest.mock('../../genesys/genesys-destination-adapter.js');

describe('ImageProcessor', () => {
  let sourceAdapter: ImageSourceAdapter;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<ImageSourceAdapter, GenesysDestinationAdapter>;
  let imageProcessor: ImageProcessor;
  let mockGetAttachment: jest.Mock<() => Promise<Image | null>>;
  let mockLookupImage: jest.Mock<() => Promise<string | null>>;
  let mockUploadImage: jest.Mock<() => Promise<string | null>>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
      getAttachment: jest.fn<() => Promise<Image | null>>(),
      getResourceBaseUrl: jest.fn<() => string>(),
    };
    mockGetAttachment = sourceAdapter.getAttachment as jest.Mock<
      () => Promise<Image | null>
    >;

    destinationAdapter = new GenesysDestinationAdapter();
    mockLookupImage = destinationAdapter.lookupImage as jest.Mock<
      () => Promise<string | null>
    >;

    mockUploadImage = destinationAdapter.uploadImage as jest.Mock<
      () => Promise<string | null>
    >;

    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    imageProcessor = new ImageProcessor();

    await imageProcessor.initialize({}, adapters, {} as PipeContext);
  });

  describe('runOnCategory', () => {
    it('should return untouched', async () => {
      const category = generateNormalizedCategory('1');

      const result = await imageProcessor.runOnCategory(cloneDeep(category));

      expect(result).toEqual(category);
    });
  });

  describe('runOnLabel', () => {
    it('should return untouched', async () => {
      const label = generateNormalizedLabel('1');

      const result = await imageProcessor.runOnLabel(cloneDeep(label));

      expect(result).toEqual(label);
    });
  });

  describe('runOnDocument', () => {
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
      const result = await imageProcessor.runOnDocument(
        generateNormalizedDocument('1'),
      );

      expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
        'https://api.mypurecloud.com/image',
      );
    });

    it('should replace all image block urls within a table', async () => {
      const result = await imageProcessor.runOnDocument(
        generateDocumentWithTable('1'),
      );

      expect(
        result.published?.variations[0].body?.blocks[1].table?.rows[0].cells[0]
          .blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
      expect(
        result.published?.variations[0].body?.blocks[1].table?.rows[1].cells[0]
          .blocks[0].image?.url,
      ).toBe('https://api.mypurecloud.com/image');
    });

    it('should not replace image block urls if adapter.getAttachment throws domain not allowed error', async () => {
      mockGetAttachment.mockRejectedValue(
        new AttachmentDomainNotAllowedError('https://attachment-url'),
      );

      const result = await imageProcessor.runOnDocument(
        generateNormalizedDocument('1'),
      );

      expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
        'https://document-image.url',
      );
    });

    it('should propagate other adapter.getAttachment errors', async () => {
      mockGetAttachment.mockRejectedValue(
        new Error('something unexpected happened'),
      );

      await expect(
        imageProcessor.runOnDocument(generateNormalizedDocument('1')),
      ).rejects.toThrow('something unexpected happened');
    });

    it('should download images with relative urls from allowed domains', async () => {
      const config = {
        relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
        attachmentDomainAllowList: 'api-cdn.usw2.pure.cloud',
      };
      imageProcessor = new ImageProcessor();
      await imageProcessor.initialize(config, adapters, {} as PipeContext);
      mockGetAttachment.mockResolvedValue(null);
      const document = generateNormalizedDocument('1');
      document.published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.jpg';

      const result = await imageProcessor.runOnDocument(document);

      expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
        'https://api.mypurecloud.com/image',
      );
    });

    it('should not download images with relative urls from not allowed domains', async () => {
      const config = {
        relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
        attachmentDomainAllowList: 'api-cdn.mypurecloud.com',
      };
      imageProcessor = new ImageProcessor();
      await imageProcessor.initialize(config, adapters, {} as PipeContext);
      mockGetAttachment.mockResolvedValue(null);
      const document = generateNormalizedDocument('1');
      document.published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.jpg';

      const result = await imageProcessor.runOnDocument(document);

      expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
        'https://api-cdn.usw2.pure.cloud/relative-image.jpg',
      );
    });

    it('should update original relative url to base+relative when upload fails', async () => {
      const config = {
        relativeImageBaseUrl: 'https://api-cdn.usw2.pure.cloud',
        attachmentDomainAllowList: 'api-cdn.usw2.pure.com',
      };
      imageProcessor = new ImageProcessor();
      await imageProcessor.initialize(config, adapters, {} as PipeContext);
      mockGetAttachment.mockResolvedValue({
        url: 'https://attachment-url',
        name: 'test.png',
        contentType: 'image/png',
        content: new Blob([]),
      });
      mockLookupImage.mockResolvedValue(null);
      mockUploadImage.mockRejectedValue(new Error('Failed'));
      const document = generateNormalizedDocument('1');
      document.published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.jpg';

      const result = await imageProcessor.runOnDocument(document);

      expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
        'https://api-cdn.usw2.pure.cloud/relative-image.jpg',
      );
    });
  });

  describe('when disableImageUpload is true', () => {
    let document: Document;
    beforeEach(async () => {
      document = generateNormalizedDocument('1');
      document.published!.variations[0].body!.blocks[0].image!.url =
        'relative-image.png';
    });

    describe('when relativeImageBaseUrl is empty', () => {
      beforeEach(async () => {
        await imageProcessor.initialize(
          {
            disableImageUpload: 'true',
          },
          adapters,
          {} as PipeContext,
        );
      });

      it('should do nothing', async () => {
        const result = await imageProcessor.runOnDocument(document);

        expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
          'relative-image.png',
        );
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
          {} as PipeContext,
        );
      });

      it('should extend relative image URLs', async () => {
        const result = await imageProcessor.runOnDocument(document);

        expect(result.published?.variations[0].body?.blocks[0].image?.url).toBe(
          'https://api-cdn.usw2.pure.cloud/relative-image.png',
        );
        expect(mockGetAttachment).not.toHaveBeenCalled();
      });
    });
  });
});
