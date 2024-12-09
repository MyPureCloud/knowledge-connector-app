import { AdapterPair } from '../../adapter/adapter-pair.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import {
  extractDocumentIdFromUrl,
  extractLinkBlocksFromVariation,
} from '../../utils/link-object-extractor.js';
import { getLogger } from '../../utils/logger.js';
import { DocumentLinkProcessorConfig } from './document-link-processor-config.js';
import { Document } from '../../model/document.js';
import { Category, Label } from '../../model';
import { Processor } from '../processor.js';
import { PipeContext } from '../../pipe/pipe-context.js';
import { DocumentLinkError } from './document-link-error.js';

export class DocumentLinkProcessor implements Processor {
  private config: DocumentLinkProcessorConfig = {};
  private context?: PipeContext;
  private externalIdPrefix: string = '';
  private regexp: RegExp | undefined;

  public async initialize(
    config: DocumentLinkProcessorConfig,
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
    context: PipeContext,
  ): Promise<void> {
    this.config = config;
    this.context = context;
    this.externalIdPrefix = config.externalIdPrefix || '';
    this.regexp = adapters.sourceAdapter.getDocumentLinkMatcherRegexp();
  }

  public async runOnCategory(item: Category): Promise<Category> {
    return item;
  }

  public async runOnLabel(item: Label): Promise<Label> {
    return item;
  }

  public async runOnDocument(item: Document): Promise<Document> {
    if (this.config.updateDocumentLinks !== 'true') {
      return item;
    }

    const { articleLookupTable } = this.context!;
    if (!articleLookupTable) {
      getLogger().warn(
        'Cannot update internal article links. Lookup table does not exist',
      );
      return item;
    }

    [
      ...(item.published?.variations || []),
      ...(item.draft?.variations || []),
    ].forEach((variation) => {
      extractLinkBlocksFromVariation(variation).forEach((block) => {
        if (!block.hyperlink) {
          return;
        }

        const documentId = extractDocumentIdFromUrl(
          block.hyperlink,
          this.regexp,
        );

        if (!documentId) {
          return;
        }

        const externalLink = articleLookupTable[documentId];

        if (!externalLink) {
          throw new DocumentLinkError('Cannot resolve link', {
            link: block.hyperlink,
            articleId: item.externalId,
          });
        }

        delete block.hyperlink;
        block.externalDocumentId =
          this.externalIdPrefix + externalLink.externalDocumentId;
        block.externalVariationName = externalLink.externalVariationName;
      });
    });

    return item;
  }

  public getPriority(): number {
    return 60;
  }
}
