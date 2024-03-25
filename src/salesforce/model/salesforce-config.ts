import { Config } from '../../config.js';

export interface SalesforceConfig extends Config {
  salesforceBaseUrl?: string;
  salesforceApiVersion?: string;
  salesforceUsername?: string;
  salesforcePassword?: string;
  salesforceClientId?: string;
  salesforceClientSecret?: string;
  salesforceLanguageCode?: string;
  salesforceArticleContentFields?: string;
}
