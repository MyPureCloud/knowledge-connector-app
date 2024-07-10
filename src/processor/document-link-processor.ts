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
  DocumentBodyTableCellBlock,
  DocumentBodyTableRowBlock,
  DocumentListContentBlock,
  DocumentTableContentBlock,
  DocumentText,
} from 'knowledge-html-converter';
import { DocumentBodyListBlock } from 'knowledge-html-converter/dist/models/blocks/document-body-list';

export class DocumentLinkProcessor implements Processor {
  private sourceAdapter?: SourceAdapter<any, any, any>;

  public async initialize(
    _config: Config,
    adapters: AdapterPair<SourceAdapter<any, any, any>, DestinationAdapter>,
  ): Promise<void> {
    this.sourceAdapter = adapters.sourceAdapter;
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    const articleLookupTable = content.articleLookupTable;
    if (!articleLookupTable) {
      // TODO: log that skip due to there was no lookup table
      return content;
    }

    content.documents.forEach((document) => {
      [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ].forEach((variation) => {
        this.extractLinkBlocksFromVariation(variation).forEach((block) => {
          const externalId = this.sourceAdapter?.extractDocumentIdFromUrl(
            articleLookupTable,
            block.hyperlink,
          );
          if (externalId) {
            block.externalDocumentId = externalId;
          }
        });
      });
    });
    return content;
  }

  private extractLinkBlocksFromVariation(variation: Variation): LinkBlock[] {
    if (!variation || !variation.body || !variation.body.blocks) {
      return [];
    }

    return variation.body.blocks
      .map((block) => this.extractLinkBlocksFromDocumentBodyBlock(block))
      .flat();
  }

  private extractLinkBlocksFromDocumentBodyBlock(
    block: DocumentBodyBlock,
  ): LinkBlock[] {
    if (!block) {
      return [];
    }

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
  ): LinkBlock[] {
    if (!paragraphBlock || !paragraphBlock.blocks) {
      return [];
    }

    return paragraphBlock.blocks
      .map((block) => this.extractLinkBlocksFromDocumentContentBlock(block))
      .flat();
  }

  private extractLinkBlocksFromImage(
    image: DocumentBodyImage | undefined,
  ): LinkBlock[] {
    if (!image) {
      return [];
    }
    return this.extractLinkBlocksFromImage(image);
  }

  private extractLinkBlocksFromList(
    list: DocumentBodyList | undefined,
  ): LinkBlock[] {
    if (!list || !list.blocks) {
      return [];
    }

    return list.blocks
      .map((block) => this.extractLinkBlocksFromDocumentBodyListBlock(block))
      .flat();
  }

  private extractLinkBlocksFromTable(
    table: DocumentBodyTable | undefined,
  ): LinkBlock[] {
    if (!table) {
      return [];
    }

    return table.rows
      .map((block) =>
        this.extractLinkBlocksFromDocumentBodyTableRowBlock(block),
      )
      .flat();
  }

  private extractLinkBlocksFromDocumentContentBlock(
    block: DocumentContentBlock | undefined,
  ): LinkBlock[] {
    if (!block) {
      return [];
    }

    switch (block.type) {
      case 'Text':
        return this.extractLinkBlocksFromDocumentText(block.text);
      case 'Image':
        return this.extractLinkBlocksFromDocumentBodyImage(block.image);
      default:
        return [];
    }
  }

  private extractLinkBlocksFromDocumentText(
    text: DocumentText | undefined,
  ): LinkBlock[] {
    if (!text || !text.hyperlink) {
      return [];
    }

    return [text as LinkBlock];
  }

  private extractLinkBlocksFromDocumentBodyImage(
    image: DocumentBodyImage | undefined,
  ): LinkBlock[] {
    if (!image || !image.hyperlink) {
      return [];
    }

    return [image as LinkBlock];
  }

  private extractLinkBlocksFromDocumentBodyListBlock(
    block: DocumentBodyListBlock | undefined,
  ): LinkBlock[] {
    if (!block || !block.blocks) {
      return [];
    }

    return block.blocks
      .map((block) => this.extractLinkBlocksFromDocumentListContentBlock(block))
      .flat();
  }

  private extractLinkBlocksFromDocumentListContentBlock(
    block: DocumentListContentBlock | undefined,
  ): LinkBlock[] {
    if (!block) {
      return [];
    }

    switch (block.type) {
      case 'Text':
        return this.extractLinkBlocksFromDocumentText(block.text);
      case 'Image':
        return this.extractLinkBlocksFromImage(block.image);
      case 'OrderedList':
      case 'UnorderedList':
        return this.extractLinkBlocksFromList(block.list);
      default:
        return [];
    }
  }

  private extractLinkBlocksFromDocumentBodyTableRowBlock(
    row: DocumentBodyTableRowBlock,
  ): LinkBlock[] {
    if (!row) {
      return [];
    }

    return row.cells
      .map((cell) => this.extractLinkBlocksFromDocumentBodyTableCellBlock(cell))
      .flat();
  }

  private extractLinkBlocksFromDocumentBodyTableCellBlock(
    cell: DocumentBodyTableCellBlock,
  ): LinkBlock[] {
    if (!cell) {
      return [];
    }

    return cell.blocks
      .map((block) =>
        this.extractLinkBlocksFromDocumentBodyTableContentBlock(block),
      )
      .flat();
  }

  private extractLinkBlocksFromDocumentBodyTableContentBlock(
    block: DocumentTableContentBlock,
  ): LinkBlock[] {
    if (!block) {
      return [];
    }

    switch (block.type) {
      case 'Paragraph':
        return this.extractLinkBlocksFromParagraph(block.paragraph);
      case 'Text':
        return this.extractLinkBlocksFromDocumentText(block.text);
      case 'Image':
        return this.extractLinkBlocksFromImage(block.image);
      case 'OrderedList':
      case 'UnorderedList':
        return this.extractLinkBlocksFromList(block.list);
      default:
        return [];
    }
  }
}
