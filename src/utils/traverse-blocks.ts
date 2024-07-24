import {
  Block,
  DocumentBodyBlock,
  DocumentBodyImageBlock,
  DocumentBodyListBlock,
  DocumentBodyListElementBlock,
  DocumentBodyParagraphBlock,
  DocumentBodyTableBlock,
  DocumentBodyTableCaptionItem,
  DocumentBodyTableCellBlock,
  DocumentBodyTableRowBlock,
  DocumentBodyVideoBlock,
  DocumentContentBlock,
  DocumentListContentBlock,
  DocumentTableContentBlock,
  DocumentTextBlock,
} from 'knowledge-html-converter';

export function* traverseBlocks(
  blocks: DocumentBodyBlock[] | undefined,
): Generator<Block> {
  yield* loop(blocks || []);
}

function* loop(
  blocks:
    | DocumentBodyBlock[]
    | DocumentContentBlock[]
    | DocumentBodyListBlock[]
    | DocumentListContentBlock[]
    | DocumentTableContentBlock[]
    | DocumentBodyTableCaptionItem[],
) {
  for (const block of blocks) {
    yield* traverse(block);
  }
}

function* traverse(
  block:
    | DocumentBodyBlock
    | DocumentContentBlock
    | DocumentBodyListBlock
    | DocumentListContentBlock
    | DocumentTableContentBlock,
): Generator<Block> {
  switch (block.type) {
    case 'Text':
      yield block as DocumentTextBlock;
      break;
    case 'Image':
      yield block as DocumentBodyImageBlock;
      break;
    case 'Video':
      yield block as DocumentBodyVideoBlock;
      break;
    case 'Paragraph':
      yield block as DocumentBodyParagraphBlock;
      yield* loop((block as DocumentBodyParagraphBlock).paragraph.blocks || []);
      break;
    case 'OrderedList':
    case 'UnorderedList':
      yield block as DocumentBodyListElementBlock;
      yield* loop((block as DocumentBodyListElementBlock).list.blocks || []);
      break;
    case 'ListItem':
      yield block as DocumentBodyListBlock;
      yield* loop((block as DocumentBodyListBlock).blocks || []);
      break;
    case 'Table':
      yield block as DocumentBodyTableBlock;
      yield* traverseTable(block as DocumentBodyTableBlock);
      yield* loop(block.table?.properties?.caption?.blocks || []);
      break;
  }
}

function* traverseTable(block: DocumentBodyTableBlock): Generator<Block> {
  const children = ((block as DocumentBodyTableBlock).table.rows || []).flatMap(
    (row: DocumentBodyTableRowBlock) =>
      (row.cells || []).flatMap(
        (cell: DocumentBodyTableCellBlock) => cell.blocks || [],
      ),
  );
  yield* loop(children);
}
