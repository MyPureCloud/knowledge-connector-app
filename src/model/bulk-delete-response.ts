export interface BulkDeleteResponse {
  results: (BulkEntity<void> | BulkErrorEntity)[];
  errorCount: number;
  errorIndexes: number[];
}

interface BulkEntity<T> {
  entity: T;
}

interface BulkErrorEntity {
  error: {
    message: string;
  };
}
