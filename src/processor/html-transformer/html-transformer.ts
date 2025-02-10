import { Config } from '../../config.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import { convertHtmlToBlocks } from 'knowledge-html-converter';
import { Document } from '../../model/document.js';
import { Category, Label } from '../../model';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';
import { HtmlConverterError } from '../../utils/errors/html-converter-error.js';
import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { EntityType } from '../../model/entity-type.js';

export class HtmlTransformer implements Processor {
  public async initialize(
    _config: Config,
    _adapters: AdapterPair<Adapter, Adapter>,
    _context: PipeContext,
  ): Promise<void> {
    // do nothing
  }

  public async runOnCategory(item: Category): Promise<Category> {
    return item;
  }

  public async runOnLabel(item: Label): Promise<Label> {
    return item;
  }

  public async runOnDocument(item: Document): Promise<Document> {
    [
      ...(item.published?.variations || []),
      ...(item.draft?.variations || []),
    ].forEach((variation) => {
      if (!variation.rawHtml && variation.body) {
        return;
      }
      try {
        const blocks = convertHtmlToBlocks(variation.rawHtml || '');
        variation.body = {
          blocks,
        };
        delete variation.rawHtml;
      } catch (error) {
        throw new HtmlConverterError(ErrorCodes.HTML_CONVERTER_ERROR, (error as Error).message, EntityType.DOCUMENT)
      }
    });

    return item;
  }

  public getPriority(): number {
    return 90;
  }
}
