import { JobStatusResponse } from './job-status-response.js';

export interface UploadAssetStatusResponse extends JobStatusResponse {
  errorCode: string;
  errorMessage: string;
}
