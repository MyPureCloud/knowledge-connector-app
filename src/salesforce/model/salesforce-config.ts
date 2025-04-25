import { Config } from '../../config.js';

export interface SalesforceConfig extends Config {
  sourceUserAgent?: string;
  salesforceLoginUrl?: string;
  salesforceBaseUrl?: string;
  salesforceApiVersion?: string;
  salesforceUsername?: string;
  salesforcePassword?: string;
  salesforceClientId?: string;
  salesforceClientSecret?: string;
  salesforceLanguageCode?: string;
  salesforceChannel?: string;
  salesforceCategories?: string;
  salesforceArticleContentFields?: string;
  salesforceLightningBaseUrl?: string;
}
