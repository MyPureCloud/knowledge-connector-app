import { Identifiable } from './identifiable.js';

export interface CategoryReference extends Identifiable {
  name: string | null;
}
