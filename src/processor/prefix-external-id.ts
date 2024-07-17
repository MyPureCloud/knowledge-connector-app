import { Processor } from './processor.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { PrefixExternalIdConfig } from './prefix-external-id-config.js';
import { ExternalIdentifiable } from '../model/external-identifiable.js';
import { ExternalLink } from '../model/external-link.js';

/**
 * Processor to extend every external ID with given prefix. Use EXTERNAL_ID_PREFIX in configuration.
 * This configured prefix is used to distinguish between documents coming from different sources.
 * Only remove obsolete documents if it's source is the same as the currently processed source.
 */
export class PrefixExternalId implements Processor {
  private config: PrefixExternalIdConfig = {};

  public async initialize(
    config: PrefixExternalIdConfig,
    _adapters: AdapterPair<Adapter, Adapter>,
  ): Promise<void> {
    this.config = config;
  }

  public async run(content: ExternalContent): Promise<ExternalContent> {
    const prefix = this.config.externalIdPrefix;

    if (prefix) {
      this.replaceListExternalId(content.documents, prefix);
      this.replaceListExternalId(content.categories, prefix);
      this.replaceListExternalId(content.labels, prefix);
      this.replaceMapExternalId(content.articleLookupTable, prefix);
    }
    return content;
  }

  private replaceListExternalId(
    list: ExternalIdentifiable[],
    prefix: string,
  ): void {
    list.forEach((item) => {
      item.externalId = prefix + item.externalId;
    });
  }

  private replaceMapExternalId(
    map: Map<string, ExternalLink> | undefined,
    prefix: string,
  ): void {
    if (!map) {
      return;
    }

    map.forEach((value) => {
      value.externalDocumentId = prefix + value.externalDocumentId;
    });
  }
}
