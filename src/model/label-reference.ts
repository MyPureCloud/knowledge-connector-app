import { Identifiable } from './identifiable.js';

export interface LabelReference extends Identifiable {
  name: string | null;
}
