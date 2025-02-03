import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ContextRepository } from './context-repository.js';
import { PipeContext } from '../pipe/pipe-context.js';

export class ContextFileRepository implements ContextRepository {
  public async load(): Promise<PipeContext | null> {
    const data = readFileSync('./context.json');
    return JSON.parse(data.toString());
  }

  public async save(context: PipeContext): Promise<void> {
    writeFileSync('./context.json', JSON.stringify(context, null, 2), 'utf8');
  }

  public async exists(): Promise<boolean> {
    return Promise.resolve(existsSync('./context.json'));
  }
}
