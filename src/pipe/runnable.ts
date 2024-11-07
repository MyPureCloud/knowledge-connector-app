import { Task } from './task.js';
import { Category, Document, Label } from '../model';

export interface Runnable<C, L, D> extends Task {
  runOnCategory(content: Category): Promise<C>;

  runOnLabel(content: Label): Promise<L>;

  runOnDocument(content: Document): Promise<D>;
}
