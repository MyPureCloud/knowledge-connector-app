import { ExternalIdentifiable } from './external-identifiable.js';

export interface NamedEntity extends ExternalIdentifiable {
  name: string | null;
}
