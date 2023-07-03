import { JobStatusResponse } from '../genesys/model/job-status-response.js';

export interface ImportDataResponse extends JobStatusResponse {
  failedEntitiesURL?: string;
}
