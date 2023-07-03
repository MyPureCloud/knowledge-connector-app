import { JobStatusResponse } from './job-status-response.js';

export interface ExportArticlesResponse extends JobStatusResponse {
  downloadURL: string;
}
