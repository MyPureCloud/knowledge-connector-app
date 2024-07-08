import { Processor } from './processor';
import { AdapterPair } from '../adapter/adapter-pair';
import { ExternalContent, Variation } from '../model';
import { SourceAdapter } from '../adapter/source-adapter';
import { DestinationAdapter } from '../adapter/destination-adapter';
import { Config } from '../config';
import { LinkBlock } from '../model/link-block';
import { DocumentBodyBlock } from 'knowledge-html-converter/dist/models/blocks/document-body-block';
import {
  DocumentBodyParagraph,
  DocumentContentBlock,
} from 'knowledge-html-converter/dist/models/blocks/document-body-paragraph';
import {
  DocumentBodyImage,
  DocumentBodyList,
  DocumentBodyTable,
  DocumentText,
} from 'knowledge-html-converter';

export class DocumentLinkProcessor implements Processor {
  private regexps: string[] = [];

  public async initialize(
    _config: Config,
    adapters: AdapterPair<SourceAdapter<any, any, any>, DestinationAdapter>,
  ): Promise<void> {
    this.regexps = adapters.sourceAdapter.getDocumentLinkRegexps();
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    content.documents.forEach((document) => {
      [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ].forEach((variation) => {
        this.extractLinkBlocksFromVariation(variation).forEach((block) => {
          // TODO update the block itself
          const linkBlock = block as LinkBlock;
          const externalId = this.extractDocumentIdFromUrl(linkBlock.hyperlink);
          if (externalId) {
            linkBlock.externalDocumentId = externalId;
          }
        });
      });
    });
    return content;
  }

  private extractDocumentIdFromUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }

    for (const regex of this.regexps) {
      const match = url.match(regex);
      if (match && match[2]) {
        return match[2]; // Return the captured value if a match is found
      }
    }
    return null;
  }

  private extractLinkBlocksFromVariation(variation: Variation): Object[] {
    if (!variation || !variation.body || !variation.body.blocks) {
      return [];
    }

    variation.body.blocks.map((block) =>
      this.extractLinkBlocksFromDocumentBodyBlock(block),
    );
    return [];
  }

  private extractLinkBlocksFromDocumentBodyBlock(
    block: DocumentBodyBlock,
  ): Object[] {
    switch (block.type) {
      case 'Paragraph':
        return this.extractLinkBlocksFromParagraph(block.paragraph);
      case 'Image':
        return this.extractLinkBlocksFromImage(block.image);
      case 'OrderedList':
      case 'UnorderedList':
        return this.extractLinkBlocksFromList(block.list);
      case 'Table':
        return this.extractLinkBlocksFromTable(block.table);
      default:
        return [];
    }
  }

  private extractLinkBlocksFromParagraph(
    paragraphBlock: DocumentBodyParagraph | undefined,
  ): Object[] {
    if (!paragraphBlock) {
      return [];
    }

    return paragraphBlock.blocks.map((block) =>
      this.extractLinkBlocksFromDocumentContentBlock(block),
    );
  }

  private extractLinkBlocksFromImage(
    image: DocumentBodyImage | undefined,
  ): Object[] {
    if (!image) {
      return [];
    }
    return this.extractLinkBlocksFromImage(image);
  }

  private extractLinkBlocksFromList(list: DocumentBodyList | undefined) {
    return [];
  }

  private extractLinkBlocksFromTable(table: DocumentBodyTable | undefined) {
    return [];
  }

  private extractLinkBlocksFromDocumentContentBlock(
    block: DocumentContentBlock | undefined,
  ) {
    if (!block) {
      return [];
    }

    switch (block.type) {
      case 'Text':
        return this.extractLinkBlocksFromTextBlock(block.text);
      case 'Image':
        return this.extractLinkBlocksFromImageBlock(block.image);
      default:
        return [];
    }
  }

  private extractLinkBlocksFromTextBlock(text: DocumentText | undefined) {
    return [text];
  }

  private extractLinkBlocksFromImageBlock(
    image: DocumentBodyImage | undefined,
  ) {
    return [image];
  }
}
