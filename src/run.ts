import { Pipe } from './pipe/pipe.js';
import { GenesysDestinationAdapter } from './genesys/genesys-destination-adapter.js';
import { loadConfigurer } from './utils/configurer-loader.js';
import { parseConfig } from './utils/config-parser.js';
import winston from 'winston';
import { setLogger } from './utils/logger.js';

const config = parseConfig();

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
  level: config['logLevel']?.toLowerCase() ?? 'info',
});
setLogger(logger);

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
