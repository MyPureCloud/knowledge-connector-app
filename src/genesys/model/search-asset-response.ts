export interface SearchAssetResponse {
  total: number;
  pageCount: number;
  pageSize: number;
  pageNumber: number;
  results: AssetResponse[];
}

export interface AssetResponse {
  id: string;
  name: string;
  contentLength: 0;
  contentLocation: string;
  contentType: string;
  dateCreated: string;
  dateModified: string;
  selfUri: string;
}
