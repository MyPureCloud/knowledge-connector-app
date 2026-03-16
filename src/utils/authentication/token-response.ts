export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtInMs: number | undefined;
}
