import { TokenResponse } from './token-response.js';

export interface TokenResponseParser<R> {
  parse(json: R): TokenResponse;
}
