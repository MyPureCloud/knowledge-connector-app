export interface ServiceNowCategory {
  sys_id: string;
  full_category: string;
  parent_id?: {
    link: string;
    value: string;
  };
}
