export interface ExportArticlesRequest {
  exportFilter: {
    documentsFilter?: {
      interval?: string;
    };
    versionFilter: 'Latest';
    exclude?: string[];
  };
  fileType: 'json';
  jsonFileVersion: 3;
}
