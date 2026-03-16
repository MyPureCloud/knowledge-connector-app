import { AuthenticationProvider } from './authentication-provider.js';
import { URLSearchParams } from 'node:url';
import { fetchSourceResource } from '../web-client.js';
import { validateNonNull } from '../validate-non-null.js';
import { catcher } from '../catch-error-helper.js';
import { ApiError } from '../../adapter/errors/api-error.js';
import { InvalidCredentialsError } from '../../adapter/errors/invalid-credentials-error.js';
import { Interrupted } from '../errors/interrupted.js';
import { TokenResponseParser } from './token-response-parser.js';

export abstract class OauthAuthenticationProvider<
  R,
> implements AuthenticationProvider<R> {
  protected expiresAt: number | undefined;
  protected accessToken: string | undefined;
  protected refreshToken: string | undefined;

  protected constructor(
    private readonly requestTokenUrl: string,
    private readonly tokenResponseParser: TokenResponseParser<R>,
  ) {}

  public abstract authenticate(): Promise<R>;

  public async constructHeaders(): Promise<Record<string, string>> {
    if (this.notAuthenticated()) {
      await this.authenticate();
    }
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  protected abstract refreshAccessToken(): Promise<void>;

  protected async getAccessToken(body: URLSearchParams): Promise<R> {
    const request = {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const data = await fetchSourceResource<R>(this.requestTokenUrl, request);
      const tokenResponse = this.tokenResponseParser.parse(data);

      validateNonNull(
        tokenResponse.accessToken,
        `Access token not found in the response: ${JSON.stringify(data)}`,
      );

      this.accessToken = tokenResponse.accessToken;
      this.refreshToken = tokenResponse.refreshToken;
      this.expiresAt = tokenResponse.expiresAtInMs;

      return data;
    } catch (error) {
      return await catcher<R>()
        .on(ApiError, (apiError) => {
          throw InvalidCredentialsError.fromApiError(
            `Failed to get access token. Reason: ${apiError.message}`,
            apiError as ApiError,
          );
        })
        .rethrow(Interrupted)
        .any(() => {
          throw new InvalidCredentialsError(
            `Failed to get access token. Reason: ${error}`,
            { messageParams: { message: error } },
          );
        })
        .with(error);
    }
  }

  private notAuthenticated(): boolean {
    return !this.accessToken;
  }

  private isTokenExpired(): boolean {
    return !!this.expiresAt && Date.now() >= this.expiresAt;
  }
}
