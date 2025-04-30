import { Config } from '../../config.js';

export interface ServiceNowConfig extends Config {
  servicenowBaseUrl?: string;
  servicenowUsername?: string;
  servicenowPassword?: string;
  servicenowClientId?: string;
  servicenowClientSecret?: string;
  servicenowAuthenticationType?: AuthenticationType;
  limit?: string;
  servicenowKnowledgeBases?: string;
  servicenowLanguage?: string;
  servicenowCategories?: string;
}

export enum AuthenticationType {
  OAUTH = 'oauth',
  BASIC = 'basic',
}
