import { createHash } from 'crypto';
import { Image } from '../../model/image.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { ImageSourceAdapter } from '../../adapter/image-source-adapter.js';
import { validateNonNull } from '../../utils/validate-non-null.js';
import { Document, Variation } from '../../model/document.js';
import {
  DocumentBodyBlock,
  DocumentBodyImageBlock,
  DocumentBodyListBlock,
  DocumentBodyListElementBlock,
  DocumentBodyParagraphBlock,
  DocumentBodyTableBlock,
  DocumentBodyTableCellBlock,
  DocumentBodyTableRowBlock,
  DocumentContentBlock,
  DocumentTableContentBlock,
} from 'knowledge-html-converter';
import { fetchImage } from '../../utils/web-client.js';
import { ImageConfig } from './image-config.js';
import { FileReaderClient } from '../../utils/file-reader-client.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import { AttachmentDomainValidator } from '../attachment-domain-validator/attachment-domain-validator.js';
import { getLogger } from '../../utils/logger.js';
import { AttachmentDomainNotAllowedError } from '../attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { removeTrailingSlash } from '../../utils/remove-trailing-slash.js';
import { isRelativeUrl } from '../../utils/links.js';
import { Category, Label } from '../../model';
import { Processor } from '../processor.js';
import { Context } from '../../context/context.js';
import { catcher } from '../../utils/catch-error-helper.js';
import { Interrupted } from '../../utils/errors/interrupted.js';
import { FileTypeNotSupportedError } from '../../genesys/errors/file-type-not-supported-error.js';

export class ImageProcessor implements Processor {
  private config: ImageConfig = {};
  private adapter?: ImageSourceAdapter;
  private genesysAdapter?: DestinationAdapter;
  private attachmentDomainValidator?: AttachmentDomainValidator;
  private uploadedImageCount: number = 0;
  private allowImageFromFilesystem: boolean = false;
  private relativeImageBaseUrl: string = '';

  public async initialize(
    config: ImageConfig,
    adapters: AdapterPair<ImageSourceAdapter, DestinationAdapter>,
    _context: Context,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.sourceAdapter;
    this.genesysAdapter = adapters.destinationAdapter;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
    this.allowImageFromFilesystem =
      this.config.allowImageFromFilesystem === 'true';
    if (this.config?.relativeImageBaseUrl) {
      this.relativeImageBaseUrl = removeTrailingSlash(
        config.relativeImageBaseUrl ?? '',
      );
    } else if (this.config?.useResourceBaseUrl === 'true') {
      this.relativeImageBaseUrl = adapters.sourceAdapter.getResourceBaseUrl();
    }
  }

  public async runOnCategory(item: Category): Promise<Category> {
    return item;
  }

  public async runOnLabel(item: Label): Promise<Label> {
    return item;
  }

  /**
   * Run the processor on a document
   * @param item
   * @throws ApiError
   */
  public async runOnDocument(item: Document): Promise<Document> {
    validateNonNull(this.adapter, 'Missing source adapter');
    validateNonNull(this.genesysAdapter, 'Missing destination adapter');

    if (this.config.disableImageUpload === 'true') {
      getLogger().info(
        `No images will be uploaded to destination. Image upload is disabled.`,
      );
    }

    this.uploadedImageCount = 0;

    for (const variation of [
      ...(item.published?.variations || []),
      ...(item.draft?.variations || []),
    ]) {
      await this.processArticle(item, variation);
    }

    getLogger().info(`Images uploaded: ${this.uploadedImageCount}`);
    return item;
  }

  public getPriority(): number {
    return 0;
  }

  private async processArticle(
    document: Document,
    variation: Variation,
  ): Promise<void> {
    if (!variation.body) {
      getLogger().warn('Variation has no body');
      return;
    }

    const imageBlocks = this.findAllImageBlocks(variation.body.blocks);

    if (this.config.disableImageUpload === 'true') {
      if (this.relativeImageBaseUrl) {
        for (const imageBlock of imageBlocks) {
          this.processImageBlockWithoutUpload(imageBlock);
        }
      }
      return;
    }

    for (const imageBlock of imageBlocks) {
      await this.processImageBlock(document.externalId, imageBlock);
    }
  }

  private processImageBlockWithoutUpload(imageBlock: DocumentBodyImageBlock) {
    const url = imageBlock.image.url;
    if (url && isRelativeUrl(url)) {
      const resolvedURL = new URL(url, this.relativeImageBaseUrl);
      imageBlock.image.url = resolvedURL.href;
    }
  }

  private async processImageBlock(
    articleId: string | null,
    imageBlock: DocumentBodyImageBlock,
  ): Promise<void> {
    getLogger().debug(
      'Processing image block with URL ' + imageBlock.image.url,
    );
    const image = await this.fetchImage(articleId, imageBlock.image.url);

    if (!image) {
      getLogger().debug(
        `Cannot fetch image [${imageBlock.image.url}] for article [${articleId}]`,
      );
      this.processImageBlockWithoutUpload(imageBlock);
      return;
    }

    const hash = await this.calculateHash(image.content);
    let result = await this.genesysAdapter!.lookupImage(hash);

    if (!result) {
      try {
        result = await this.genesysAdapter!.uploadImage(hash, image);
        if (result) {
          this.uploadedImageCount++;
        }
      } catch (error) {
        await catcher<void>()
          .rethrow(Interrupted)
          .on(FileTypeNotSupportedError, () => {
            getLogger().warn(
              `Not supported file type ${image.url}`,
              error as Error,
            );
            this.processImageBlockWithoutUpload(imageBlock);
          })
          .any((error: Error) => {
            getLogger().error(
              `Cannot upload image ${image.url} - ${error}`,
              error as Error,
            );
            this.processImageBlockWithoutUpload(imageBlock);
          })
          .with(error);
        return;
      }
    }

    if (result) {
      imageBlock.image.url = result;
    }
  }

  private findAllImageBlocks(
    blocks: (
      | DocumentBodyBlock
      | DocumentContentBlock
      | DocumentBodyListBlock
      | DocumentTableContentBlock
    )[],
  ): DocumentBodyImageBlock[] {
    return blocks.flatMap((block) => {
      let children: (
        | DocumentBodyBlock
        | DocumentContentBlock
        | DocumentBodyListBlock
        | DocumentTableContentBlock
      )[];

      switch (block.type) {
        case 'Image':
          return [block as DocumentBodyImageBlock];
        case 'Paragraph':
          children = (block as DocumentBodyParagraphBlock).paragraph.blocks;
          break;
        case 'OrderedList':
        case 'UnorderedList':
          children = (block as DocumentBodyListElementBlock).list.blocks;
          break;
        case 'ListItem':
          children = (block as DocumentBodyListBlock).blocks;
          break;
        case 'Table':
          children = (block as DocumentBodyTableBlock).table.rows.flatMap(
            (row: DocumentBodyTableRowBlock) =>
              row.cells.flatMap(
                (cell: DocumentBodyTableCellBlock) => cell.blocks || [],
              ),
          );
          break;
        default:
          children = [];
      }
      return this.findAllImageBlocks(children);
    });
  }

  private async fetchImage(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (url.startsWith('file:')) {
      if (this.allowImageFromFilesystem) {
        return this.readFile(url);
      } else {
        return null;
      }
    }

    let image: Image | null;
    try {
      image = await this.adapter!.getAttachment(articleId, url);
    } catch (error) {
      return await catcher<null>()
        .on(AttachmentDomainNotAllowedError, (error) => {
          getLogger().debug(error.message);
          return null;
        })
        .with(error);
    }

    if (!image) {
      getLogger().debug(`Trying to fetch image [${url}] directly`);

      if (isRelativeUrl(url)) {
        if (!this.relativeImageBaseUrl) {
          getLogger().debug(
            `Relative image url [${url}] found but missing RELATIVE_IMAGE_BASE_URL from config`,
          );
          return null;
        }
        const resolvedURL = new URL(url, this.relativeImageBaseUrl);
        url = resolvedURL.href;
      }

      if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
        getLogger().debug(
          'Skipped downloading image, domain not allowed: ' + url,
        );
        return null;
      }

      try {
        image = await this.downloadImage(url);
      } catch (error) {
        return await catcher<null>()
          .rethrow(Interrupted)
          .any((error) => {
            getLogger().warn(
              `Unable to fetch image [${url}] directly - ${error}`,
              error as Error,
            );
            return null;
          })
          .with(error);
      }
    }

    return image;
  }

  private async calculateHash(blob: Blob): Promise<string> {
    return createHash('SHA-1')
      .update(new Uint8Array(await blob.arrayBuffer()))
      .digest('hex');
  }

  private async downloadImage(url: string): Promise<Image> {
    return fetchImage(url);
  }

  private async readFile(url: string): Promise<Image> {
    return FileReaderClient.readImage(url);
  }
}
