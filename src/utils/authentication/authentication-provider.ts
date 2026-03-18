export interface AuthenticationProvider<R> {
  authenticate(): Promise<R>;

  constructHeaders(): Promise<Record<string, string>>;
}
