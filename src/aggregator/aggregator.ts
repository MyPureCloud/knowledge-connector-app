import { Runnable } from '../pipe/runnable.js';

/**
 * Aggregator task is responsible to process the content collected from source system,
 * and transform it into ImportableContents
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Aggregator extends Runnable<void, void, void> {}
