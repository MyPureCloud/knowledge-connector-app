import { AdapterPair } from '../../adapter/adapter-pair.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import { UrlTransformerConfig } from './url-transformer-config.js';
import { Document, Variation } from '../../model/document.js';
import {
  DocumentBodyImageBlock,
  DocumentTextBlock,
} from 'knowledge-html-converter';
import { traverseBlocks } from '../../utils/traverse-blocks.js';
import { convertToAbsolute, isRelativeUrl } from '../../utils/links.js';
import { Category, Label } from '../../model';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';
import { decode } from 'html-entities';

export class UrlTransformer implements Processor {
  private config: UrlTransformerConfig = {};
  private fixNonHttpsImages: boolean = false;
  private fixNonHttpsLinks: boolean = false;
  private relativeLinkBaseUrl: string | null = null;
  private decodeHtmlEntitiesInLinks: boolean = false;

  public async initialize(
    config: UrlTransformerConfig,
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
    _context: PipeContext,
  ): Promise<void> {
    this.config = config;

    this.fixNonHttpsImages = this.config.fixNonHttpsImages === 'true';
    this.fixNonHttpsLinks = this.config.fixNonHttpsLinks === 'true';
    this.relativeLinkBaseUrl =
      adapters.sourceAdapter.getResourceBaseUrl() || null;
    this.decodeHtmlEntitiesInLinks =
      this.config.decodeHtmlEntitiesInLinks === 'true';
  }

  public async runOnCategory(item: Category): Promise<Category> {
    return item;
  }

  public async runOnLabel(item: Label): Promise<Label> {
    return item;
  }

  public async runOnDocument(item: Document): Promise<Document> {
    if (
      !this.fixNonHttpsImages &&
      !this.fixNonHttpsLinks &&
      !this.relativeLinkBaseUrl &&
      !this.decodeHtmlEntitiesInLinks
    ) {
      return item;
    }

    [
      ...(item.published?.variations || []),
      ...(item.draft?.variations || []),
    ].forEach((variation: Variation) => this.fixUrls(variation));

    return item;
  }

  public getPriority(): number {
    return 60;
  }

  private fixUrls(variation: Variation): void {
    const traversal = traverseBlocks(variation.body?.blocks);

    for (const block of traversal) {
      if (block.type === 'Image') {
        this.fixImageUrls(block as DocumentBodyImageBlock);
      } else if (block.type === 'Text') {
        this.fixTextUrls(block as DocumentTextBlock);
      }
    }
  }

  private fixTextUrls(text: DocumentTextBlock) {
    if (this.fixNonHttpsLinks && text.text.hyperlink) {
      text.text.hyperlink = this.fixLink('hyperlink', text.text);
    }
    if (text.text.hyperlink) {
      text.text.hyperlink = this.amendRelative('hyperlink', text.text);
    }
    if (this.decodeHtmlEntitiesInLinks && text.text.hyperlink) {
      text.text.hyperlink = this.decodeHtmlEntities('hyperlink', text.text);
    }
  }

  private fixImageUrls(image: DocumentBodyImageBlock) {
    if (this.fixNonHttpsImages && image.image.url) {
      image.image.url = this.fixLink('url', image.image)!;
    }
    if (this.fixNonHttpsLinks && image.image.hyperlink) {
      image.image.hyperlink = this.fixLink('hyperlink', image.image);
    }
    if (this.decodeHtmlEntitiesInLinks && image.image.hyperlink) {
      image.image.hyperlink = this.decodeHtmlEntities('hyperlink', image.image);
    }
    if (image.image.hyperlink) {
      image.image.hyperlink = this.amendRelative('hyperlink', image.image);
    }
  }

  private fixLink<T>(prop: keyof T, obj: T): string | undefined {
    const url = obj[prop] as string | undefined;
    if (url?.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  }

  private amendRelative<T>(prop: keyof T, obj: T): string | undefined {
    const url = obj[prop] as string | undefined;
    if (url && this.relativeLinkBaseUrl && isRelativeUrl(url)) {
      return convertToAbsolute(url, this.relativeLinkBaseUrl);
    }
    return url;
  }

  private decodeHtmlEntities<T>(prop: keyof T, obj: T): string | undefined {
    const url = obj[prop] as string | undefined;
    return decode(url);
  }
}
