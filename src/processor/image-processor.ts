import { Processor } from './processor.js';
import { ExternalContent } from '../model/external-content.js';
import { Blob } from 'buffer';
import { createHash } from 'crypto';
import { Image } from '../model/image.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { Document, Variation } from '../model/import-export-model.js';
import logger from '../utils/logger.js';
import {
  DocumentBodyBlock, DocumentBodyTableCellBlock, DocumentBodyTableRowBlock,
  DocumentContentBlock, DocumentTableContentBlock,
} from 'knowledge-html-converter';
import { fetchImage } from '../utils/web-client.js';
import { DocumentBodyImageBlock } from 'knowledge-html-converter/dist/models/blocks/document-body-image.js';
import {
  DocumentBodyListBlock,
  DocumentBodyListElementBlock,
} from 'knowledge-html-converter/dist/models/blocks/document-body-list.js';
import { DocumentBodyParagraphBlock } from 'knowledge-html-converter/dist/models/blocks/document-body-paragraph.js';
import { ImageConfig } from './image-config.js';
import { FileReaderClient } from '../utils/file-reader-client.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import { DocumentBodyTableBlock } from 'knowledge-html-converter/dist/models/blocks/document-body-table.js';

export class ImageProcessor implements Processor {
  private config: ImageConfig = {};
  private adapter?: ImageSourceAdapter;
  private genesysAdapter?: DestinationAdapter;
  private uploadedImageCount: number = 0;

  public async initialize(
    config: ImageConfig,
    adapters: AdapterPair<ImageSourceAdapter, DestinationAdapter>,
  ): Promise<void> {
    this.config = config;
    this.adapter = adapters.sourceAdapter;
    this.genesysAdapter = adapters.destinationAdapter;
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
    logger.info(`Images uploaded: ${this.uploadedImageCount}`);
    return Promise.resolve(content);
  }

  private async processArticle(
    document: Document,
    variation: Variation,
  ): Promise<void> {
    if (!variation.body) {
      logger.warn('Variation has no body');
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
    logger.debug('processing image block ' + imageBlock.image.url);
    const image = await this.fetchImage(articleId, imageBlock.image.url);

    if (!image) {
      logger.warn(
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
          children = (block as DocumentBodyTableBlock).table.rows.flatMap((row: DocumentBodyTableRowBlock) =>
            row.cells.flatMap((cell: DocumentBodyTableCellBlock) => (cell.blocks || []))
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

    let image = await this.adapter!.getAttachment(articleId, url);

    if (!image) {
      logger.info(`Trying to fetch image [${url}] directly`);

      if (this.isRelativeUrl(url)) {
        if (!this.config?.relativeImageBaseUrl) {
          logger.warn(
              `Relative image url [${url}] found but missing RELATIVE_IMAGE_BASE_URL from config`,
          );
          return null;
        }
        const resolvedURL = new URL(
            url,
            this.config.relativeImageBaseUrl,
        );
        url = resolvedURL.href;
      }

      image = await this.downloadImage(url);
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
