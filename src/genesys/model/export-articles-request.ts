export interface ExportArticlesRequest {
  exportFilter: {
    documentsFilter?: {
      interval?: string;
    };
    versionFilter: 'Latest';
  };
  fileType: 'json';
}
