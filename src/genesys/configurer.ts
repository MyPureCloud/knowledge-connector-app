import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { GenesysLoader } from './genesys-loader.js';
import { GenesysSourceAdapter } from './genesys-source-adapter.js';
import { ImageProcessor } from '../processor/image-processor.js';
import { PrefixExternalId } from '../processor/prefix-external-id.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { ObsoleteDocumentRemover } from '../uploader/obsolete-document-remover.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new GenesysSourceAdapter())
    .loaders(new GenesysLoader())
    .processors(new ImageProcessor(), new PrefixExternalId())
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader(), new ObsoleteDocumentRemover());
};
