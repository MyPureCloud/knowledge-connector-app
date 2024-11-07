import { ZendeskAdapter } from './zendesk-adapter.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { ZendeskContext } from './model/zendesk-context.js';
import {
  articleMapper,
  categoryMapper,
  labelMapper,
} from './content-mapper.js';
import { Document } from '../model/document.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskArticle } from './model/zendesk-article.js';

/**
 * ZendeskLoader is a specific {@Link Loader} implementation for fetching data from Zendesk's API
 */
export class ZendeskLoader extends AbstractLoader<ZendeskContext> {
  private adapter?: ZendeskAdapter;

  public async initialize(
    _config: ZendeskConfig,
    adapters: AdapterPair<ZendeskAdapter, Adapter>,
    context: ZendeskContext,
  ): Promise<void> {
    await super.initialize(_config, adapters, context);

    this.adapter = adapters.sourceAdapter;
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    yield* this.loadItems<ZendeskSection, Category>(
      this.adapter!.categoryIterator(),
      (item: ZendeskSection): Category[] => {
        this.addCategoryToLookupTable(item);

        return categoryMapper(item, this.context!);
      },
      this.context!.adapter.unprocessedItems.categories,
    );
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (!this.shouldLoadLabels()) {
      return;
    }

    yield* this.loadItems<ZendeskLabel, Label>(
      this.adapter!.labelIterator(),
      labelMapper,
      this.context!.adapter.unprocessedItems.labels,
    );
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    yield* this.loadItems<ZendeskArticle, Document>(
      this.adapter!.articleIterator(),
      (item: ZendeskArticle): Document[] => {
        return articleMapper(
          item,
          this.context!,
          this.shouldLoadCategories(),
          this.shouldLoadLabels(),
        );
      },
      this.context!.adapter.unprocessedItems.articles,
    );
  }

  private addCategoryToLookupTable(item: ZendeskSection) {
    this.context!.categoryLookupTable[String(item.id)] = item;
  }
}
