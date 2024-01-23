import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { ImageProcessor } from '../processor/image-processor.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { SalesforceAdapter } from './salesforce-adapter.js';
import { SalesforceLoader } from './salesforce-loader.js';
import { HtmlTransformer } from '../processor/html-transformer.js';
import { PrefixExternalId } from '../processor/prefix-external-id.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new SalesforceAdapter())
    .loaders(new SalesforceLoader())
    .processors(
      new HtmlTransformer(),
      new ImageProcessor(),
      new PrefixExternalId(),
    )
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader());
};
