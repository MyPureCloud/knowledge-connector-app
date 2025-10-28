import { Config } from '../../config.js';

export interface SalesforceConfig extends Config {
  salesforceLoginUrl?: string;
  salesforceBaseUrl?: string;
  salesforceApiVersion?: string;
  salesforceOauthGrantType?: string;
  salesforceUsername?: string;
  salesforcePassword?: string;
  salesforceClientId?: string;
  salesforceClientSecret?: string;
  salesforceLanguageCode?: string;
  salesforceChannel?: string;
  salesforceCategories?: string;
  salesforceArticleContentFields?: string;
}
