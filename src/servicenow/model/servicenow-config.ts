import { Config } from '../../config.js';

export interface ServiceNowConfig extends Config {
  servicenowBaseUrl?: string;
  servicenowUsername?: string;
  servicenowPassword?: string;
  limit?: string;
  servicenowKnowledgeBases?: string;
  servicenowLanguage?: string;
  servicenowCategoryNames?: string;
}
