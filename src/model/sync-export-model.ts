import { Category } from './category.js';
import { Label } from './label.js';
import { Document } from './document.js';

export interface SyncModel {
  version: number;
  importAction: {
    knowledgeBase: {
      id: string;
    };
    documents: Document[];
    categories: Category[];
    labels: Label[];
  };
  deleteAction: {
    documents: string[];
    categories: string[];
    labels: string[];
  };
}

export interface ExportModel {
  version: number;
  importAction: {
    knowledgeBase: {
      id: string;
    };
    documents: Document[];
    categories: Category[];
    labels: Label[];
  };
}
