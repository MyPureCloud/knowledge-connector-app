import { Config } from '../../config.js';

export interface UrlTransformerConfig extends Config {
  fixNonHttpsImages?: string;
  fixNonHttpsLinks?: string;
  relativeLinkBaseUrl?: string;
}
