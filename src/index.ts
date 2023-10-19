import { Pipe } from './pipe/pipe.js';
import { ImageProcessor } from './processor/image-processor.js';
import { DiffUploader } from './uploader/diff-uploader.js';
import { DiffAggregator } from './aggregator/diff-aggregator.js';
import { config as dotEnvConfig } from 'dotenv';
import _ from 'lodash';
import { GenesysDestinationAdapter } from './genesys/genesys-destination-adapter.js';
import logger from './utils/logger.js';
import { ObsoleteDocumentRemover } from './uploader/obsolete-document-remover.js';
import { PrefixExternalId } from './processor/prefix-external-id.js';
import { GenesysLoader } from './genesys/genesys-loader.js';
import { GenesysSourceAdapter } from './genesys/genesys-source-adapter.js';
import { ZendeskLoader } from './zendesk/zendesk-loader.js';
import { ZendeskAdapter } from './zendesk/zendesk-adapter.js';
import { HtmlTransformer } from './processor/html-transformer.js';

dotEnvConfig();

const config = _.mapKeys(
  process.env,
  (value: string | undefined, key: string) => _.camelCase(key),
);

logger.debug('Configuration: ' + JSON.stringify(config));

const destinationAdapter = new GenesysDestinationAdapter();

try {
  config.loader ? console.log(`Loader Selected: ${config.loader}`) : console.error('Set a LOADER in the env first')
  if(config.loader === 'genesys'){
    const sourceAdapter = new GenesysSourceAdapter();
    await new Pipe()
    .adapters({
      sourceAdapter,
      destinationAdapter,
    })
    .loaders(new GenesysLoader())
    .processors(new ImageProcessor(), new PrefixExternalId())
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader(), new ObsoleteDocumentRemover())
    .start(config);
  }
  if(config.loader === 'zendesk'){
    const sourceAdapter = new ZendeskAdapter();
    await new Pipe()
    .adapters({
      sourceAdapter,
      destinationAdapter,
    })
    .loaders(new ZendeskLoader())
    .processors(
      new HtmlTransformer(),
      new ImageProcessor(),
    )
    .aggregator(new DiffAggregator())
    .uploaders(new DiffUploader(), new ObsoleteDocumentRemover())
    .start(config);
  }

} catch (error) {
  logger.error('Connector app aborted.', error);
}
