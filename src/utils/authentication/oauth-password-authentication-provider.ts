import { URLSearchParams } from 'node:url';
import { TokenResponseParser } from './token-response-parser.js';
import { OauthAuthenticationProvider } from './oauth-authentication-provider.js';

export class OauthPasswordAuthenticationProvider<
  R,
> extends OauthAuthenticationProvider<R> {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly username: string,
    private readonly password: string,
    requestTokenUrl: string,
    tokenResponseParser: TokenResponseParser<R>,
  ) {
    super(requestTokenUrl, tokenResponseParser);
  }

  public async authenticate(): Promise<R> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('username', this.username);
    params.append('password', this.password);

    return this.getAccessToken(params);
  }

  protected async refreshAccessToken(): Promise<void> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('refresh_token', this.refreshToken!);

    await this.getAccessToken(params);
  }
}
