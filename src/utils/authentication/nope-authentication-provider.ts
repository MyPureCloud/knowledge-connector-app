import { AuthenticationProvider } from './authentication-provider.js';

export class NopeAuthenticationProvider<
  R,
> implements AuthenticationProvider<R> {
  public authenticate(): Promise<R> {
    return Promise.resolve({} as R);
  }

  public async constructHeaders(): Promise<Record<string, string>> {
    return {};
  }
}
