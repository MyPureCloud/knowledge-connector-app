import { EntityWithMetadata } from './entity-with-metadata.js';
import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './document.js';

export interface FailedItems {
  categories: EntityWithMetadata<Category>[];
  labels: EntityWithMetadata<Label>[];
  documents: EntityWithMetadata<Document>[];
}
