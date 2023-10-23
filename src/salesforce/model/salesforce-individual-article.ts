export interface SalesforceIndividualArticle {
  articleNumber: string;
  articleType: string;
  layoutItems:[
    {
      label: string;
      type: string;
      value: string;
    }
  ]
}
