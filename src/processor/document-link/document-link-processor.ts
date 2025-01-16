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
import { ExternalLink } from '../../model/external-link.js';

export class DocumentLinkProcessor implements Processor {
  private config: DocumentLinkProcessorConfig = {};
  private context?: PipeContext;
  private externalIdPrefix: string = '';
  private regexp: RegExp | undefined;
  private sourceAdapter: SourceAdapter<unknown, unknown, unknown> | null = null;

  public async initialize(
    config: DocumentLinkProcessorConfig,
    adapters: AdapterPair<
      SourceAdapter<unknown, unknown, unknown>,
      DestinationAdapter
    >,
    context: PipeContext,
  ): Promise<void> {
    this.config = config;
    this.sourceAdapter = adapters.sourceAdapter;
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

  public async runOnDocument(
    item: Document,
    firstTry: boolean = true,
  ): Promise<Document> {
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

    for (const variation of [
      ...(item.published?.variations || []),
      ...(item.draft?.variations || []),
    ]) {
      for (const block of extractLinkBlocksFromVariation(variation)) {
        if (!block.hyperlink) {
          continue;
        }

        const documentId = extractDocumentIdFromUrl(
          block.hyperlink,
          this.regexp,
        );

        if (!documentId) {
          continue;
        }

        let externalLink: ExternalLink | null | undefined = this.lookup(
          documentId,
          articleLookupTable,
          firstTry,
          block.hyperlink,
          item.externalId,
        );

        if (!externalLink) {
          externalLink = await this.fetchDocumentInfoFromSource(
            documentId,
            articleLookupTable,
          );
        }

        if (externalLink) {
          delete block.hyperlink;
          block.externalDocumentId =
            this.externalIdPrefix + externalLink.externalDocumentId;
          if (externalLink.externalDocumentIdAlternatives?.length) {
            block.externalDocumentIdAlternatives =
              externalLink.externalDocumentIdAlternatives.map(
                (id) => `${this.externalIdPrefix}${id}`,
              );
          }
          if (externalLink.externalVariationName) {
            block.externalVariationName = externalLink.externalVariationName;
          }
        }
      }
    }

    return item;
  }

  public getPriority(): number {
    return 60;
  }

  private lookup(
    linkedId: string,
    lookupTable: Record<string, ExternalLink>,
    firstTry: boolean,
    hyperlink: string,
    articleId: string | null,
  ): ExternalLink {
    const externalLink = lookupTable[linkedId];

    if (!externalLink && firstTry) {
      throw new DocumentLinkError('Cannot resolve link', {
        link: hyperlink,
        articleId,
      });
    }

    return externalLink;
  }

  private async fetchDocumentInfoFromSource(
    documentId: string,
    lookupTable: Record<string, ExternalLink>,
  ): Promise<ExternalLink | null> {
    const externalLink =
      await this.sourceAdapter!.constructDocumentLink(documentId);
    if (!externalLink || !lookupTable[externalLink.externalDocumentId]) {
      return null;
    }

    return externalLink;
  }
}
