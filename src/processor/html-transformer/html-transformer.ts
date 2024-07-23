import { Processor } from '../processor.js';
import { Config } from '../../config.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Adapter } from '../../adapter/adapter.js';
import { ExternalContent } from '../../model/external-content.js';
import { convertHtmlToBlocks } from 'knowledge-html-converter';

export class HtmlTransformer implements Processor {
  public async initialize(
    _config: Config,
    _adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void> {
    // do nothing
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    content.documents.forEach((document) => {
      [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ].forEach((variation) => {
        const blocks = convertHtmlToBlocks(variation.rawHtml || '');
        variation.body = {
          blocks,
        };
        delete variation.rawHtml;
      });
    });
    return content;
  }
}
