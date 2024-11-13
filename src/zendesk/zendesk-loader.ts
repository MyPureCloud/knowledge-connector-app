import { ZendeskAdapter } from './zendesk-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { ZendeskCategory } from './model/zendesk-category.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { ZendeskContext } from './model/zendesk-context.js';
import { articleMapper, categoryMapper, labelMapper } from './content-mapper.js';
import { Document } from '../model/document.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';

/**
 * ZendeskLoader is a specific {@Link Loader} implementation for fetching data from Zendesk's API
 */
export class ZendeskLoader extends AbstractLoader {
  private adapter?: ZendeskAdapter;
  private context?: ZendeskContext;

  public async initialize(
    _config: ZendeskConfig,
    adapters: AdapterPair<ZendeskAdapter, Adapter>,
  ): Promise<void> {
    await super.initialize(_config, adapters);

    this.adapter = adapters.sourceAdapter;

    this.context = {
      processedItems: {
        categories: [],
        labels: [],
        documents: [],
      },
      unprocessedItems: {
        categories: [],
        labels: [],
        articles: [],
      },
      unprocessableItems: {
        categories: [],
        labels: [],
        articles: [],
      },
      categoryLookupTable: new Map<string, ZendeskCategory>(),
    };
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');

    const categories = await arraysFromAsync(this.categoryIterator());
    const labels = await arraysFromAsync(this.labelIterator());
    const documents = await arraysFromAsync(this.documentIterator());

    const data: ExternalContent = {
      categories,
      labels,
      documents
    };

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Labels loaded: ' + data.labels.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }
    for await (const item of this.adapter!.articleIterator()) {
      yield articleMapper(item, this.context!, this.shouldLoadCategories(), this.shouldLoadLabels());
    }
}

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    for await (const item of this.adapter!.categoryIterator()) {
      this.context!.categoryLookupTable.set(String(item.id), item);

      const category = categoryMapper(item, this.context!);
      if (category) {
        yield category;
      } else {
        this.context!.unprocessedItems.categories.push(item);
      }
    }

    const unprocessed = [...this.context!.unprocessedItems.categories];
    this.context!.unprocessedItems.categories = [];
    for (const item of unprocessed) {
      const category = categoryMapper(item, this.context!);
      if (category) {
        yield category;
      }
    }
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (!this.shouldLoadLabels()) {
      return;
    }
    for await (const item of this.adapter!.labelIterator()) {
      yield labelMapper(item);
    }
  }
}
