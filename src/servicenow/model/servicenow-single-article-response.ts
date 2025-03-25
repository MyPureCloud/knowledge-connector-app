export interface ServiceNowSingleArticleResponse {
  result: ServiceNowSingleArticle;
}

export interface ServiceNowSingleArticle {
  sys_id: string;
  short_description: string;
  number: string;
  content: string;
  fields?: {
    category?: {
      value: string;
    };
    topic?: {
      value: string;
    };
    kb_category?: {
      value: string;
    };
    kb_knowledge_base?: {
      value: string;
    };
    workflow_state?: {
      value: string;
    };
    sys_updated_on?: {
      value: string;
    };
    active?: {
      value: string;
    };
    valid_to?: {
      value: string;
    };
  };
}
