import {
  categoryMapper,
  documentMapper,
  labelMapper,
} from './content-mapper.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { GenesysSourceAdapter } from './genesys-source-adapter.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { GenesysContext } from './model/genesys-context.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';

/**
 * Loader for fetching data from Genesys Knowledge
 */
export class GenesysLoader extends AbstractLoader<GenesysContext> {
  private adapter?: GenesysSourceAdapter;

  public async initialize(
    config: GenesysSourceConfig,
    adapters: AdapterPair<GenesysSourceAdapter, Adapter>,
    context: GenesysContext,
  ): Promise<void> {
    await super.initialize(config, adapters, context);

    this.adapter = adapters.sourceAdapter;
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    for await (const item of this.adapter!.categoryIterator()) {
      yield categoryMapper(item);
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

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    yield* this.loadItems<Document, Document>(
      this.adapter!.articleIterator(),
      (item: Document): Document[] => {
        this.addArticleToLookupTable(item);

        return [documentMapper(item)];
      },
      this.context!.adapter.unprocessedItems.articles,
    );
  }

  private addArticleToLookupTable(article: Document): void {
    [
      ...(article.published?.variations || []),
      ...(article.draft?.variations || []),
    ].forEach((variation) => {
      this.context!.articleLookupTable[`${article.id}#${variation.id}`] = {
        externalDocumentId: article.id!,
        externalVariationName: variation.name,
      };
    });
  }
}
