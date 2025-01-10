import { Task } from './task.js';
import { Category, Document, Label } from '../model';

export interface Runnable<C, L, D> extends Task {
  runOnCategory(content: Category, firstTry?: boolean): Promise<C>;

  runOnLabel(content: Label, firstTry?: boolean): Promise<L>;

  runOnDocument(content: Document, firstTry?: boolean): Promise<D>;
}
