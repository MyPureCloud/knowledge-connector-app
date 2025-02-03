import { beforeEach, describe, expect, it } from '@jest/globals';
import { Pager } from './pager.js';
import { arraysFromAsync } from './arrays';

describe('Pager', () => {
  const unprocessedItems: string[] = [];
  const nextPage: string[] = [];
  let pager: Pager<string>;

  beforeEach(() => {
    pager = new Pager(unprocessedItems, getNextPage);
  });

  describe('fetch', () => {
    it('should yield unprocessed items first', async () => {
      unprocessedItems.push('first', 'second', 'third');
      nextPage.push('fourth', 'last');

      const actual = await arraysFromAsync(pager.fetch());

      expect(actual).toEqual(['first', 'second', 'third', 'fourth', 'last']);
    });

    it('should yield items from page after page', async () => {
      nextPage.push(
        'first',
        'second',
        'third',
        'fourth',
        'fifth',
        'sixth',
        'last',
      );

      const actual = await arraysFromAsync(pager.fetch());

      expect(actual).toEqual([
        'first',
        'second',
        'third',
        'fourth',
        'fifth',
        'sixth',
        'last',
      ]);
    });
  });

  async function getNextPage(): Promise<string[] | null> {
    return nextPage.length > 0 ? nextPage.splice(0, 2) : null;
  }
});
