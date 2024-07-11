import { Label } from './label.js';
import { Category } from './category.js';
import { Document } from './sync-export-model.js';
import { ExternalLink } from './external-link';

export interface ExternalContent {
  categories: Category[];
  labels: Label[];
  documents: Document[];
  articleLookupTable?: Map<string, ExternalLink>;
}
