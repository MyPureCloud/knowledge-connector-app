import { TokenResponseParser } from '../utils/authentication/token-response-parser.js';
import { ServiceNowAccessTokenResponse } from './model/servicenow-access-token-response.js';
import { TokenResponse } from '../utils/authentication/token-response.js';

export class ServiceNowTokenParser implements TokenResponseParser<ServiceNowAccessTokenResponse> {
  parse(json: ServiceNowAccessTokenResponse): TokenResponse {
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAtInMs: Date.now() + json.expires_in * 1000,
    };
  }
}
