import { Label } from './label.js';
import { Category } from './category.js';
import { Document } from './document.js';
import { ExternalLink } from './external-link.js';

export interface ExternalContent {
  categories: Category[];
  labels: Label[];
  documents: Document[];
  articleLookupTable?: Map<string, ExternalLink>;
}
