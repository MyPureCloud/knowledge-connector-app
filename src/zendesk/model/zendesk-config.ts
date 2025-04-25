import { Config } from '../../config.js';

export interface ZendeskConfig extends Config {
  sourceUserAgent?: string;
  zendeskUsername?: string;
  zendeskPassword?: string;
  zendeskBaseUrl?: string;
  zendeskLocale?: string;
}
