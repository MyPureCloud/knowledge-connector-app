import { Variation } from '../model/document.js';
import { LinkBlock } from '../model/link-block.js';
import {
  DocumentBodyBlock,
  DocumentBodyImage,
  DocumentBodyList,
  DocumentBodyListBlock,
  DocumentBodyParagraph,
  DocumentBodyTable,
  DocumentBodyTableCaptionItem,
  DocumentBodyTableCellBlock,
  DocumentBodyTableProperties,
  DocumentBodyTableRowBlock,
  DocumentContentBlock,
  DocumentListContentBlock,
  DocumentTableContentBlock,
  DocumentText,
} from 'knowledge-html-converter';
import { ExternalLink } from '../model/external-link.js';

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
  const key = match.slice(1).join('#');
  return articleLookupTable.get(key);
}

export function extractLinkBlocksFromVariation(
  variation: Variation,
): LinkBlock[] {
  if (!variation?.body?.blocks) {
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
  if (!paragraphBlock?.blocks) {
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
  if (!list?.blocks) {
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

  const propertiesLinkBlocks: LinkBlock[] =
    extractLinkBlocksFromTableProperties(table.properties);
  const tableLinkBlocks = table.rows
    .map((block) => extractLinkBlocksFromDocumentBodyTableRowBlock(block))
    .flat();

  return [...propertiesLinkBlocks, ...tableLinkBlocks];
}

function extractLinkBlocksFromTableProperties(
  properties: DocumentBodyTableProperties | undefined,
): LinkBlock[] {
  if (!properties?.caption?.blocks) {
    return [];
  }

  return properties?.caption?.blocks
    .map((block) => extractLinkBlocksFromDocumentBodyTableCaptionItem(block))
    .flat();
}

function extractLinkBlocksFromDocumentBodyTableCaptionItem(
  block: DocumentBodyTableCaptionItem | undefined,
): LinkBlock[] {
  if (!block) {
    return [];
  }

  switch (block.type) {
    case 'Text':
      return extractLinkBlocksFromDocumentText(block.text);
    case 'Paragraph':
      return extractLinkBlocksFromParagraph(block.paragraph);
    case 'Image':
      return extractLinkBlocksFromDocumentBodyImage(block.image);
    case 'OrderedList':
    case 'UnorderedList':
      return extractLinkBlocksFromList(block.list);
    default:
      return [];
  }
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
  if (!block?.blocks) {
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
  if (!row?.cells) {
    return [];
  }

  return row.cells
    .map((cell) => extractLinkBlocksFromDocumentBodyTableCellBlock(cell))
    .flat();
}

function extractLinkBlocksFromDocumentBodyTableCellBlock(
  cell: DocumentBodyTableCellBlock,
): LinkBlock[] {
  if (!cell?.blocks) {
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
    case 'Table':
      return extractLinkBlocksFromTable(block.table);
    default:
      return [];
  }
}
