import { ExternalIdentifiable } from './external-identifiable.js';
import { DocumentAlternative } from './document-alternative.js';
import { CategoryReference } from './category-reference.js';
import { LabelReference } from './label-reference.js';
import { DocumentBodyBlock } from 'knowledge-html-converter';

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
