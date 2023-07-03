import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysApi } from './genesys-api.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';

export class GenesysSourceApi extends GenesysApi {
  private config: GenesysSourceConfig = {};

  public initialize(config: GenesysSourceConfig): Promise<void> {
    this.config = config;
    return this.authenticate();
  }

  protected getLoginUrl(): string {
    validateNonNull(
      this.config.genesysSourceLoginUrl,
      'Missing GENESYS_SOURCE_LOGIN_URL from config',
    );
    return this.config.genesysSourceLoginUrl!;
  }

  protected getBaseUrl(): string {
    validateNonNull(
      this.config.genesysSourceBaseUrl,
      'Missing GENESYS_SOURCE_BASE_URL from config',
    );
    return this.config.genesysSourceBaseUrl!;
  }

  protected getClientId(): string {
    validateNonNull(
      this.config.genesysSourceClientId,
      'Missing GENESYS_SOURCE_CLIENT_ID from config',
    );
    return this.config.genesysSourceClientId!;
  }

  protected getClientSecret(): string {
    validateNonNull(
      this.config.genesysSourceClientSecret,
      'Missing GENESYS_SOURCE_CLIENT_SECRET from config',
    );
    return this.config.genesysSourceClientSecret!;
  }

  protected getKnowledgeBaseId(): string {
    validateNonNull(
      this.config.genesysSourceKnowledgeBaseId,
      'Missing GENESYS_SOURCE_KNOWLEDGE_BASE_ID from config',
    );
    return this.config.genesysSourceKnowledgeBaseId!;
  }
}
