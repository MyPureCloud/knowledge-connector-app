import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './document.js';
import { EntityWithMetadata } from './entity-with-metadata';

export interface SyncableContents {
  categories: ImportableContent<Category>;
  labels: ImportableContent<Label>;
  documents: ImportableContent<Document>;
}

export interface ImportableContent<T> {
  created: EntityWithMetadata<T>[];
  updated: EntityWithMetadata<T>[];
  deleted: EntityWithMetadata<T>[];
}
