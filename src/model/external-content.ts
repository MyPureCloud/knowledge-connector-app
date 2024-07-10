import { Label } from './label.js';
import { Category } from './category.js';
import { Document } from './sync-export-model.js';

export interface ExternalContent {
  categories: Category[];
  labels: Label[];
  documents: Document[];
  articleLookupTable?: { [key: string]: string };
}
