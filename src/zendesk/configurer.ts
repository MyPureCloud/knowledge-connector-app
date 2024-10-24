import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { ZendeskAdapter } from './zendesk-adapter.js';
import { ZendeskLoader } from './zendesk-loader.js';
import { HtmlTransformer } from '../processor/html-transformer/html-transformer.js';
import { ImageProcessor } from '../processor/image/image-processor.js';
import { PrefixExternalId } from '../processor/prefix-external-id/prefix-external-id.js';
import { DocumentLinkProcessor } from '../processor/document-link/document-link-processor.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { UrlTransformer } from '../processor/url-transformer/url-transformer.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new ZendeskAdapter())
    .loaders(new ZendeskLoader())
    .processors(
      new HtmlTransformer(),
      new ImageProcessor(),
      new UrlTransformer(),
      new PrefixExternalId(),
      new DocumentLinkProcessor(),
    )
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader());
};
