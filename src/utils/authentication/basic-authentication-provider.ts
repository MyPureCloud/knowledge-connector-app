import { AuthenticationProvider } from './authentication-provider.js';

export class BasicAuthenticationProvider<
  R,
> implements AuthenticationProvider<R> {
  constructor(
    private readonly username: string,
    private readonly password: string,
  ) {}

  public authenticate(): Promise<R> {
    return Promise.resolve({} as R);
  }

  public async constructHeaders(): Promise<Record<string, string>> {
    const credentialBuffer = Buffer.from(
      `${this.username}:${this.password}`,
      'utf-8',
    );
    return {
      Authorization: `Basic ${credentialBuffer.toString('base64')}`,
    };
  }
}
