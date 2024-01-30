import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './sync-export-model.js';

export interface SyncableContents {
  categories: ImportableContent<Category>;
  labels: ImportableContent<Label>;
  documents: ImportableContent<Document>;
}

export interface ImportableContent<T> {
  created: T[];
  updated: T[];
  deleted: T[];
}
