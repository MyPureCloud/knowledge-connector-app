import { Config } from '../../config.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import { convertHtmlToBlocks } from 'knowledge-html-converter';
import { Document } from '../../model/document.js';
import { Category, Label } from '../../model';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';

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
      const blocks = convertHtmlToBlocks(variation.rawHtml || '');
      variation.body = {
        blocks,
      };
      delete variation.rawHtml;
    });

    return item;
  }

  public getPriority(): number {
    return 90;
  }
}
