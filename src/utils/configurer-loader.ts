import { Config } from '../config.js';
import { Configurer } from '../pipe/configurer.js';

export async function loadConfigurer(config: Config): Promise<Configurer> {
  const moduleName = config.configurer || 'genesys';
  const moduleFile = `../${moduleName}/configurer.js`;

  const module = await import(moduleFile);
  return module.configurer;
}
