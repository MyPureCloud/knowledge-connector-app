export interface SearchAssetRequest {
  pageSize?: number;
  pageNumber?: number;
  sortOrder?: 'ASC' | 'DESC';
  sortBy?: string;
  query: [
    {
      endValue?: string;
      values?: [string];
      startValue?: string;
      fields?: [string];
      value?: string;
      type?: string;
    },
  ];
}
