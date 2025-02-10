import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import {
  CategoryReference,
  Context,
  LabelReference,
  SyncableContents,
} from '../model';
import { ExternalLink } from '../model/external-link.js';
import { FailedItems } from '../model/failed-items.js';

export interface PipeContext extends Context {
  pipe: {
    processedItems: {
      categories: Category[];
      labels: Label[];
      documents: Document[];
    };
    unprocessedItems: {
      categories: Category[];
      labels: Label[];
      documents: Document[];
    };
    failedItems: FailedItems;
  };
  storedContent?: {
    documents: Document[];
    categories: Category[];
    labels: Label[];
  };
  syncableContents: SyncableContents;
  categoryLookupTable: Record<string, CategoryReference>;
  labelLookupTable: Record<string, LabelReference>;
  articleLookupTable: Record<string, ExternalLink>;
}
