import { Processor } from '../processor.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { ExternalContent } from '../../model/external-content.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import {
  extractDocumentIdFromUrl,
  extractLinkBlocksFromVariation,
} from '../../utils/link-object-extractor.js';
import { getLogger } from '../../utils/logger.js';
import { DocumentLinkProcessorConfig } from './document-link-processor-config.js';

export class DocumentLinkProcessor implements Processor {
  private config: DocumentLinkProcessorConfig = {};
  private regexp: RegExp | undefined;

  public async initialize(
    config: DocumentLinkProcessorConfig,
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
  ): Promise<void> {
    this.config = config;
    this.regexp = adapters.sourceAdapter.getDocumentLinkMatcherRegexp();
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    const articleLookupTable = content.articleLookupTable;
    if (this.config.updateDocumentLinks !== 'true') {
      return content;
    }

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

          const externalLink = extractDocumentIdFromUrl(
            articleLookupTable,
            block.hyperlink,
            this.regexp,
          );

          if (externalLink) {
            delete block.hyperlink;
            block.externalDocumentId = externalLink.externalDocumentId;
            block.externalVariationName = externalLink.externalVariationName;
          }
        });
      });
    });
    return content;
  }
}
