import { Config } from '../../config.js';

export interface SalesforceConfig extends Config {
  salesforceUsername?: string;
  salesforcePassword?: string;
  salesforceBaseUrl?: string;
  salesforceDomain?: string,
  salesforceLocale?: string;
  salesforceSecurityToken?: string;
}
