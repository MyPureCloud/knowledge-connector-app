import { JobStatusResponse } from '../genesys/model/job-status-response.js';

export interface SyncDataResponse extends JobStatusResponse {
  failedEntitiesURL?: string;
}
