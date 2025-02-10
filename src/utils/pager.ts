import { getLogger } from './logger.js';

export class Pager<T> {
  private unprocessedItems: T[] = [];
  private readonly getNextPage: () => Promise<T[] | null> = async () => null;

  constructor(unprocessedItems: T[], getNextPage: () => Promise<T[] | null>) {
    this.unprocessedItems = unprocessedItems;
    this.getNextPage = getNextPage;
  }

  public async *fetch(): AsyncGenerator<T, void, void> {
    if (this.unprocessedItems.length) {
      for await (const item of this.processList(this.unprocessedItems)) {
        yield item;
      }
    }

    getLogger().debug(`Fetching next page`);
    let nextPage: T[] | null;
    while ((nextPage = await this.getNextPage()) !== null) {
      if (!nextPage?.length) {
        getLogger().debug(`Next page is empty`);
        return;
      }

      this.unprocessedItems = nextPage;

      getLogger().debug(`Loaded ${nextPage.length} items`);
      for await (const item of this.processList(this.unprocessedItems)) {
        yield item;
      }
      getLogger().debug(`Loading items finished`);
    }
  }

  private async *processList<T>(list: T[]): AsyncGenerator<T, void, void> {
    while (list.length > 0) {
      getLogger().debug(`yield item (${list.length} left)`);

      const item = list.shift();
      yield Promise.resolve(item!);
    }
  }
}
