import { Config } from '../../config.js';

export interface ZendeskConfig extends Config {
  zendeskUsername?: string;
  zendeskPassword?: string;
  zendeskBaseUrl?: string;
  zendeskLocale?: string;
}
