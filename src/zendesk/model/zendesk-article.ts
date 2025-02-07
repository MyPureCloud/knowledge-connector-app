export interface ZendeskArticle {
  id: string;
  title: string;
  body: string;
  draft: boolean;
  updated_at: string;
  category_id?: string;
  section_id?: string;
  label_names?: string[];
}
