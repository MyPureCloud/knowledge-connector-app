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
import { FailedEntity } from '../model/failed-entity.js';

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
    failedItems: {
      categories: FailedEntity<Category>[];
      labels: FailedEntity<Label>[];
      documents: FailedEntity<Document>[];
    };
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
