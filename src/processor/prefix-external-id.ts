import { Processor } from './processor.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { PrefixExternalIdConfig } from './prefix-external-id-config.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { ExternalIdentifiable } from '../model/external-identifiable.js';

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
    validateNonNull(
      this.config.externalIdPrefix,
      'Missing EXTERNAL_ID_PREFIX from config',
    );

    const prefix = this.config.externalIdPrefix!;

    this.replaceExternalId(content.documents, prefix);
    this.replaceExternalId(content.categories, prefix);
    this.replaceExternalId(content.labels, prefix);
    return content;
  }

  private replaceExternalId(
    list: ExternalIdentifiable[],
    prefix: string,
  ): void {
    list.forEach((item) => {
      item.externalId = prefix + item.externalId;
    });
  }
}
