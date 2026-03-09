import { PipeContext } from '../pipe';

export interface DiffUploaderContext extends PipeContext {
  diffUploader: {
    articles: {
      processedCount: number;
    };
  };
}
