import { Pipe } from './pipe/pipe.js';
import { GenesysDestinationAdapter } from './genesys/genesys-destination-adapter.js';
import logger from './utils/logger.js';
import { loadConfigurer } from './utils/configurer-loader.js';
import { parseConfig } from './utils/config-parser.js';

const config = parseConfig();

loadConfigurer(config)
  .then((configurer) => {
    return new Pipe()
      .destination(new GenesysDestinationAdapter())
      .configurer(configurer)
      .start(config);
  })
  .catch((error) => {
    logger.error('Connector app aborted.', error);
    process.exitCode = 1;
  });
