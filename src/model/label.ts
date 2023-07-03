import { ExternalIdentifiable } from './external-identifiable.js';

export interface Label extends ExternalIdentifiable {
  name: string | null;
  color: string;
}
