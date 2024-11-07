import { Category, Document, Label } from '../model';
import { Runnable } from '../pipe/runnable.js';

/**
 * Processor can perform any transformation
 */
export interface Processor extends Runnable<Category, Label, Document> {
  getPriority(): number;
}
