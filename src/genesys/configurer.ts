import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { GenesysLoader } from './genesys-loader.js';
import { GenesysSourceAdapter } from './genesys-source-adapter.js';
import { ImageProcessor } from '../processor/image/image-processor.js';
import { PrefixExternalId } from '../processor/prefix-external-id/prefix-external-id.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { DocumentLinkProcessor } from '../processor/document-link/document-link-processor.js';
import { ModificationDateFilter } from '../filter/modification-date-filter.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new GenesysSourceAdapter())
    .loaders(new GenesysLoader())
    .processors(
      new ImageProcessor(),
      new PrefixExternalId(),
      new DocumentLinkProcessor(),
    )
    .filters(new ModificationDateFilter())
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader());
};
