import { config as dotEnvConfig } from 'dotenv';
import _ from 'lodash';
import { Config } from '../config.js';
import logger from './logger.js';

dotEnvConfig();

export function parseConfig(): Config {
  const config = _.mapKeys(
    process.env,
    (value: string | undefined, key: string) => _.camelCase(key),
  );

  logger.debug('Configuration: ' + JSON.stringify(config));

  return config;
}
