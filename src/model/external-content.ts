import { Label } from './label.js';
import { Category } from './category.js';
import { Document } from './import-export-model.js';

export interface ExternalContent {
  labels: Label[];
  categories: Category[];
  documents: Document[];
}
