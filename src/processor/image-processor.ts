import { Processor } from './processor.js';
import { ExternalContent } from '../model/external-content.js';
import { createHash } from 'crypto';
import { Image } from '../model/image.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { Document, Variation } from '../model/sync-export-model.js';
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
import { fetchImage } from '../utils/web-client.js';
import { ImageConfig } from './image-config.js';
import { FileReaderClient } from '../utils/file-reader-client.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { AttachmentDomainValidator } from './attachment-domain-validator.js';
import { getLogger } from '../utils/logger.js';
import { AttachmentDomainNotAllowedError } from './attachment-domain-not-allowed-error.js';

export class ImageProcessor implements Processor {
  private config: ImageConfig = {};
  private adapter?: ImageSourceAdapter;
  private genesysAdapter?: DestinationAdapter;
  private attachmentDomainValidator?: AttachmentDomainValidator;
  private uploadedImageCount: number = 0;

  public async initialize(
    config: ImageConfig,
    adapters: AdapterPair<ImageSourceAdapter, DestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.sourceAdapter;
    this.genesysAdapter = adapters.destinationAdapter;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');
    validateNonNull(this.genesysAdapter, 'Missing destination adapter');
    this.uploadedImageCount = 0;

    for (const document of content.documents) {
      for (const variation of [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ]) {
        await this.processArticle(document, variation);
      }
    }
    getLogger().info(`Images uploaded: ${this.uploadedImageCount}`);
    return Promise.resolve(content);
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

    for (const imageBlock of imageBlocks) {
      await this.processImageBlock(document.externalId, imageBlock);
    }
  }

  private async processImageBlock(
    articleId: string | null,
    imageBlock: DocumentBodyImageBlock,
  ): Promise<void> {
    getLogger().debug('processing image block ' + imageBlock.image.url);
    const image = await this.fetchImage(articleId, imageBlock.image.url);

    if (!image) {
      getLogger().warn(
        `Cannot fetch image [${imageBlock.image.url}] for article [${articleId}]`,
      );
      return;
    }

    const hash = await this.calculateHash(image.content);
    let result = await this.genesysAdapter!.lookupImage(hash);

    if (!result) {
      result = await this.genesysAdapter!.uploadImage(hash, image);
      this.uploadedImageCount++;
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

  private isRelativeUrl(src: string) {
    try {
      const urlObject = new URL(src);
      return urlObject.protocol === null;
    } catch (error) {
      // Invalid URL, treat it as relative if it doesn't start with //
      return !src.startsWith('//');
    }
  }

  private async fetchImage(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (url.startsWith('file:')) {
      return this.readFile(url);
    }

    let image: Image | null;
    try {
      image = await this.adapter!.getAttachment(articleId, url);
    } catch (error) {
      if (error instanceof AttachmentDomainNotAllowedError) {
        getLogger().warn(error.message);
        return null;
      }
      throw error;
    }

    if (!image) {
      getLogger().info(`Trying to fetch image [${url}] directly`);

      if (this.isRelativeUrl(url)) {
        if (!this.config?.relativeImageBaseUrl) {
          getLogger().warn(
            `Relative image url [${url}] found but missing RELATIVE_IMAGE_BASE_URL from config`,
          );
          return null;
        }
        const resolvedURL = new URL(url, this.config.relativeImageBaseUrl);
        url = resolvedURL.href;
      }

      if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
        getLogger().warn(
          'Skipped downloading image, domain not allowed: ' + url,
        );
        return null;
      }

      try {
        image = await this.downloadImage(url);
      } catch (error) {
        getLogger().warn(`Unable to fetch image [${url}] directly`);
        return null;
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
