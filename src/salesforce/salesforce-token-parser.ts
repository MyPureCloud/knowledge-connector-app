import { TokenResponseParser } from '../utils/authentication/token-response-parser.js';
import { TokenResponse } from '../utils/authentication/token-response.js';
import { SalesforceAccessTokenResponse } from './model/salesforce-access-token-response.js';

export class SalesforceTokenParser implements TokenResponseParser<SalesforceAccessTokenResponse> {
  parse(json: SalesforceAccessTokenResponse): TokenResponse {
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAtInMs: undefined,
    };
  }
}
