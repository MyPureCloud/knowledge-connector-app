import { SyncableContents } from '../model/syncable-contents.js';
import { Task } from '../pipe/task.js';
import { FailedItems } from '../model/failed-items.js';

/**
 * Uploader is the final {@Link Task} in the process. It calls Genesys Knowledge's API to do the necessary changes.
 */
export interface Uploader extends Task {
  run(
    importableContents: SyncableContents,
    failedItems: FailedItems,
  ): Promise<void>;
}
