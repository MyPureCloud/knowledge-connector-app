import { Pipe } from './pipe/pipe.js';
import { ImageProcessor } from './processor/image-processor.js';
import { DiffUploader } from './uploader/diff-uploader.js';
import { DiffAggregator } from './aggregator/diff-aggregator.js';
import { config as dotEnvConfig } from 'dotenv';
import _ from 'lodash';
import { GenesysDestinationAdapter } from './genesys/genesys-destination-adapter.js';
import logger from './utils/logger.js';
import { ObsoleteArticleRemover } from './uploader/obsolete-article-remover.js';
import { GenesysSourceAdapter } from './genesys/genesys-source-adapter.js';
import { GenesysLoader } from './genesys/genesys-loader.js';
import { ZendeskLoader } from './zendesk/zendesk-loader.js';  //Added for ZendeskLoader use
import { ZendeskAdapter } from './zendesk/zendesk-adapter.js';  //Added for ZendeskAdaptor

dotEnvConfig();

const config = _.mapKeys(
  process.env,
  (value: string | undefined, key: string) => _.camelCase(key),
);

logger.debug('Configuration: ' + JSON.stringify(config));

//const sourceAdapter = new GenesysSourceAdapter(); //commented out to use ZendeskLoader
const sourceAdapter = new ZendeskAdapter();
const destinationAdapter = new GenesysDestinationAdapter();

try {
  await new Pipe()
    .adapters({
      sourceAdapter,
      destinationAdapter,
    })
    //.loaders(new GenesysLoader()) //commented out to use ZendeskLoader
    .loaders(new ZendeskLoader())
    .processors(new ImageProcessor())
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader(), new ObsoleteArticleRemover())
    .start(config);
} catch (error) {
  logger.error('Connector app aborted.', error);
}
