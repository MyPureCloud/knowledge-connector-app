import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { ImageProcessor } from '../processor/image/image-processor.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { SalesforceLoader } from './salesforce-loader.js';
import { HtmlTransformer } from '../processor/html-transformer/html-transformer.js';
import { PrefixExternalId } from '../processor/prefix-external-id/prefix-external-id.js';
import { DocumentLinkProcessor } from '../processor/document-link/document-link-processor.js';
import { UrlTransformer } from '../processor/url-transformer/url-transformer.js';
import { NameConflictResolver } from '../processor/name-conflict-resolver/name-conflict-resolver.js';
import { ModificationDateFilter } from '../filter/modification-date-filter.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new SalesforceAdapter())
    .loaders(new SalesforceLoader())
    .processors(
      new HtmlTransformer(),
      new ImageProcessor(),
      new UrlTransformer(),
      new PrefixExternalId(),
      new DocumentLinkProcessor(),
      new NameConflictResolver(),
    )
    .filter(new ModificationDateFilter())
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader());
};
