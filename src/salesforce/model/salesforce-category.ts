export interface SalesforceCategory {
  childCategories: SalesforceCategory[];
  label: string;
  name: string;
  url: string;
}
