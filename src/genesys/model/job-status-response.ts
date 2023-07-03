import { JobStatus } from './job-status.js';

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
}
