export interface SalesforceMapperConfiguration {
  languageCode: string;
  contentFields: string[];
  baseUrl: string;
  fetchLabels: boolean;
  buildExternalUrls: boolean;
}
