import { Processor } from '../processor.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { ExternalContent } from '../../model/external-content.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import { UrlTransformerConfig } from './url-transformer-config.js';
import { Document, Variation } from '../../model';
import {
  DocumentBodyImageBlock,
  DocumentTextBlock,
} from 'knowledge-html-converter';
import { traverseBlocks } from '../../utils/traverse-blocks.js';

export class UrlTransformer implements Processor {
  private config: UrlTransformerConfig = {};
  private fixNonHttpsImages: boolean = false;
  private fixNonHttpsLinks = false;

  public async initialize(
    config: UrlTransformerConfig,
    _adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
  ): Promise<void> {
    this.config = config;

    this.fixNonHttpsImages = this.config.fixNonHttpsImages === 'true';
    this.fixNonHttpsLinks = this.config.fixNonHttpsLinks === 'true';
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    if (!this.fixNonHttpsImages && !this.fixNonHttpsLinks) {
      return content;
    }

    content.documents.forEach((document: Document) => {
      [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ].forEach((variation: Variation) => this.fixSrc(variation));
    });
    return content;
  }

  private fixSrc(variation: Variation): void {
    const traversal = traverseBlocks(variation.body?.blocks);

    for (const block of traversal) {
      if (block.type === 'Image') {
        const image = block as DocumentBodyImageBlock;
        if (this.fixNonHttpsImages) {
          image.image.url = this.fixLink('url', image.image)!;
        }
        if (this.fixNonHttpsLinks) {
          image.image.hyperlink = this.fixLink('hyperlink', image.image);
        }
      } else if (block.type === 'Text') {
        const text = block as DocumentTextBlock;
        if (this.fixNonHttpsLinks) {
          text.text.hyperlink = this.fixLink('hyperlink', text.text);
        }
      }
    }
  }

  private fixLink<T>(prop: keyof T, obj: T): string | undefined {
    const url = obj[prop] as string | undefined;
    if (url?.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  }
}
