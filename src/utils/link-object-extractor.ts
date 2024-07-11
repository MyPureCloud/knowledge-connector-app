import { Variation } from '../model';
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
import { ExternalLink } from '../model/external-link';

export function extractDocumentIdFromUrl(
  articleLookupTable: Map<string, ExternalLink>,
  hyperlink: string,
  regexp: RegExp | undefined,
): ExternalLink | undefined {
  if (!regexp) {
    return undefined;
  }

  const match = hyperlink.match(regexp);
  if (!match || !match[1]) {
    return undefined;
  }
  const articleNumber = match[1];
  return articleLookupTable.get(articleNumber);
}

export function extractLinkBlocksFromVariation(
  variation: Variation,
): LinkBlock[] {
  if (!variation || !variation.body || !variation.body.blocks) {
    return [];
  }

  return variation.body.blocks
    .map((block) => extractLinkBlocksFromDocumentBodyBlock(block))
    .flat();
}

function extractLinkBlocksFromDocumentBodyBlock(
  block: DocumentBodyBlock,
): LinkBlock[] {
  if (!block) {
    return [];
  }

  switch (block.type) {
    case 'Paragraph':
      return extractLinkBlocksFromParagraph(block.paragraph);
    case 'Image':
      return extractLinkBlocksFromImage(block.image);
    case 'OrderedList':
    case 'UnorderedList':
      return extractLinkBlocksFromList(block.list);
    case 'Table':
      return extractLinkBlocksFromTable(block.table);
    default:
      return [];
  }
}

function extractLinkBlocksFromParagraph(
  paragraphBlock: DocumentBodyParagraph | undefined,
): LinkBlock[] {
  if (!paragraphBlock || !paragraphBlock.blocks) {
    return [];
  }

  return paragraphBlock.blocks
    .map((block) => extractLinkBlocksFromDocumentContentBlock(block))
    .flat();
}

function extractLinkBlocksFromImage(
  image: DocumentBodyImage | undefined,
): LinkBlock[] {
  if (!image) {
    return [];
  }
  return extractLinkBlocksFromDocumentBodyImage(image);
}

function extractLinkBlocksFromList(
  list: DocumentBodyList | undefined,
): LinkBlock[] {
  if (!list || !list.blocks) {
    return [];
  }

  return list.blocks
    .map((block) => extractLinkBlocksFromDocumentBodyListBlock(block))
    .flat();
}

function extractLinkBlocksFromTable(
  table: DocumentBodyTable | undefined,
): LinkBlock[] {
  if (!table) {
    return [];
  }

  return table.rows
    .map((block) => extractLinkBlocksFromDocumentBodyTableRowBlock(block))
    .flat();
}

function extractLinkBlocksFromDocumentContentBlock(
  block: DocumentContentBlock | undefined,
): LinkBlock[] {
  if (!block) {
    return [];
  }

  switch (block.type) {
    case 'Text':
      return extractLinkBlocksFromDocumentText(block.text);
    case 'Image':
      return extractLinkBlocksFromDocumentBodyImage(block.image);
    default:
      return [];
  }
}

function extractLinkBlocksFromDocumentText(
  text: DocumentText | undefined,
): LinkBlock[] {
  if (!text || !text.hyperlink) {
    return [];
  }

  return [text as LinkBlock];
}

function extractLinkBlocksFromDocumentBodyImage(
  image: DocumentBodyImage | undefined,
): LinkBlock[] {
  if (!image || !image.hyperlink) {
    return [];
  }

  return [image as LinkBlock];
}

function extractLinkBlocksFromDocumentBodyListBlock(
  block: DocumentBodyListBlock | undefined,
): LinkBlock[] {
  if (!block || !block.blocks) {
    return [];
  }

  return block.blocks
    .map((block) => extractLinkBlocksFromDocumentListContentBlock(block))
    .flat();
}

function extractLinkBlocksFromDocumentListContentBlock(
  block: DocumentListContentBlock | undefined,
): LinkBlock[] {
  if (!block) {
    return [];
  }

  switch (block.type) {
    case 'Text':
      return extractLinkBlocksFromDocumentText(block.text);
    case 'Image':
      return extractLinkBlocksFromImage(block.image);
    case 'OrderedList':
    case 'UnorderedList':
      return extractLinkBlocksFromList(block.list);
    default:
      return [];
  }
}

function extractLinkBlocksFromDocumentBodyTableRowBlock(
  row: DocumentBodyTableRowBlock,
): LinkBlock[] {
  if (!row) {
    return [];
  }

  return row.cells
    .map((cell) => extractLinkBlocksFromDocumentBodyTableCellBlock(cell))
    .flat();
}

function extractLinkBlocksFromDocumentBodyTableCellBlock(
  cell: DocumentBodyTableCellBlock,
): LinkBlock[] {
  if (!cell) {
    return [];
  }

  return cell.blocks
    .map((block) => extractLinkBlocksFromDocumentBodyTableContentBlock(block))
    .flat();
}

function extractLinkBlocksFromDocumentBodyTableContentBlock(
  block: DocumentTableContentBlock,
): LinkBlock[] {
  if (!block) {
    return [];
  }

  switch (block.type) {
    case 'Paragraph':
      return extractLinkBlocksFromParagraph(block.paragraph);
    case 'Text':
      return extractLinkBlocksFromDocumentText(block.text);
    case 'Image':
      return extractLinkBlocksFromImage(block.image);
    case 'OrderedList':
    case 'UnorderedList':
      return extractLinkBlocksFromList(block.list);
    default:
      return [];
  }
}
