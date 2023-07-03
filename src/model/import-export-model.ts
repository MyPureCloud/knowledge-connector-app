import { Category } from './category.js';
import { Label } from './label.js';
import { ExternalIdentifiable } from './external-identifiable.js';
import { LabelReference } from './label-reference.js';
import { CategoryReference } from './category-reference.js';
import { DocumentBodyBlock } from 'knowledge-html-converter';

export interface ImportExportModel {
  version: number;
  knowledgeBase: {
    id: string;
  };
  documents: Document[];
  categories: Category[];
  labels: Label[];
}

export interface Document extends ExternalIdentifiable {
  published: DocumentVersion | null;
  draft: DocumentVersion | null;
}

export interface DocumentVersion {
  title: string;
  visible: boolean;
  category: CategoryReference | null;
  labels: LabelReference[] | null;
  variations: Variation[];
}

export interface Variation {
  rawHtml?: string;
  body: {
    blocks: DocumentBodyBlock[];
  } | null;
}
