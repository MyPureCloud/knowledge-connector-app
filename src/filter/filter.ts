import { Runnable } from '../pipe/runnable.js';

/**
 * Filter task is responsible for conditionally allowing or blocking elements in a pipeline
 * based on a predicate condition. It evaluates input and determines whether it should
 * continue through the pipeline.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Filter extends Runnable<boolean, boolean, boolean> {}
