import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './import-export-model.js';

export interface ImportableContents {
  categories: ImportableContent<Category>;
  labels: ImportableContent<Label>;
  documents: ImportableContent<Document>;
}

export interface ImportableContent<T> {
  created: T[];
  updated: T[];
  deleted: T[];
}
