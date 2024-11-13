import {ExternalLink} from '../model/external-link.js';
import { Context } from '../model/context.js';
import { Document } from '../model/document.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';

export interface GenesysContext
  extends Context<Category, Label, Document> {
  articleLookupTable: Map<string, ExternalLink>;
}
