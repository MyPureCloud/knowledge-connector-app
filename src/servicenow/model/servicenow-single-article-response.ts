export interface ServiceNowSingleArticleResponse {
  result: ServiceNowSingleArticle;
}

export interface ServiceNowSingleArticle {
  sys_id: string;
  short_description: string;
  number: string;
  content: string;
}
