import { Category, Document, Label } from '../../model';
import { AdapterContext } from '../../adapter/adapter-context.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GenesysContext
  extends AdapterContext<Category, Label, Document> {}
