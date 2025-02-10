import { promises as fs } from 'node:fs';
import { ContextRepository } from './context-repository.js';
import { PipeContext } from '../pipe/pipe-context.js';

export class ContextFileRepository implements ContextRepository {
  private readonly FILE_NAME = './context.json';

  public async load(): Promise<PipeContext | null> {
    const data = await fs.readFile(this.FILE_NAME);
    return JSON.parse(data.toString());
  }

  public async save(context: PipeContext): Promise<void> {
    return fs.writeFile(
      this.FILE_NAME,
      JSON.stringify(context, null, 2),
      'utf8',
    );
  }

  public async exists(): Promise<boolean> {
    return fs
      .access(this.FILE_NAME)
      .then(() => true)
      .catch(() => false);
  }
}
