import { Processor } from './processor';
import { AdapterPair } from '../adapter/adapter-pair';
import { ExternalContent } from '../model';
import { SourceAdapter } from '../adapter/source-adapter';
import { DestinationAdapter } from '../adapter/destination-adapter';
import { Config } from '../config';
import {
  extractDocumentIdFromUrl,
  extractLinkBlocksFromVariation,
} from '../utils/link-object-extractor.js';
import { getLogger } from '../utils/logger.js';

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
      getLogger().warn(
        'Cannot update internal article links. Lookup table does not exist',
      );
      return content;
    }

    content.documents.forEach((document) => {
      [
        ...(document.published?.variations || []),
        ...(document.draft?.variations || []),
      ].forEach((variation) => {
        extractLinkBlocksFromVariation(variation).forEach((block) => {
          if (!block.hyperlink) {
            return;
          }

          const externalId = extractDocumentIdFromUrl(
            articleLookupTable,
            block.hyperlink,
            this.sourceAdapter?.getDocumentLinkMatcherRegexp(),
          );

          if (externalId) {
            block.hyperlink = undefined;
            block.externalDocumentId = externalId;
          }
        });
      });
    });
    return content;
  }
}
