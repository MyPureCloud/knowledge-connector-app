export interface ServicenowOAuthToken {
  bearerToken: string;
  refreshToken: string;
  expiresAt: number;
}
