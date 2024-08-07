import { Category } from './category.js';
import { Label } from './label.js';
import { ExternalIdentifiable } from './external-identifiable.js';
import { LabelReference } from './label-reference.js';
import { CategoryReference } from './category-reference.js';
import { DocumentBodyBlock } from 'knowledge-html-converter';
import { DocumentAlternative } from './document-alternative.js';

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

export interface Document extends ExternalIdentifiable {
  externalUrl: string | null;
  published: DocumentVersion | null;
  draft: DocumentVersion | null;
}

export interface DocumentVersion {
  title: string;
  alternatives: DocumentAlternative[] | null;
  visible: boolean;
  category: CategoryReference | null;
  labels: LabelReference[] | null;
  variations: Variation[];
}

export interface Variation {
  id?: string;
  priority?: number;
  name?: string;
  rawHtml?: string;
  body: {
    blocks: DocumentBodyBlock[];
  } | null;
}
