import { Configurer } from '../pipe/configurer.js';
import { Pipe } from '../pipe/pipe.js';
import { HtmlTransformer } from '../processor/html-transformer.js';
import { ImageProcessor } from '../processor/image-processor.js';
import { PrefixExternalId } from '../processor/prefix-external-id.js';
import { DiffAggregator } from '../aggregator/diff-aggregator.js';
import { DiffUploader } from '../uploader/diff-uploader.js';
import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ServiceNowLoader } from './servicenow-loader.js';

export const configurer: Configurer = (pipe: Pipe) => {
  pipe
    .source(new ServiceNowAdapter())
    .loaders(new ServiceNowLoader())
    .processors(
      new HtmlTransformer(),
      new ImageProcessor(),
      new PrefixExternalId(),
    )
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader());
};
