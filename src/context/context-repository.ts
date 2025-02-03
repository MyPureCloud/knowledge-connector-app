import { PipeContext } from '../pipe/pipe-context.js';

export interface ContextRepository {
  load(): Promise<PipeContext | null>;

  save(context: PipeContext): Promise<void>;

  exists(): Promise<boolean>;
}
