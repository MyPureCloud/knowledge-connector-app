import { Loader } from '../pipe/loader.js';
import { ExternalContent } from '../model/external-content.js';
import { documentMapper, categoryMapper, labelMapper } from './content-mapper.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { GenesysSourceAdapter } from './genesys-source-adapter.js';
import { GenesysSourceConfig } from './model/genesys-source-config.js';
import { getLogger } from '../utils/logger.js';
import { arraysFromAsync } from '../utils/arrays.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { ExternalLink } from '../model/external-link.js';
import { GenesysContext } from './genesys-context.js';

/**
 * Loader for fetching data from Genesys Knowledge
 */
export class GenesysLoader implements Loader {
  private adapter?: GenesysSourceAdapter;
  private context?: GenesysContext;

  public async initialize(
    _config: GenesysSourceConfig,
    adapters: AdapterPair<GenesysSourceAdapter, Adapter>,
  ): Promise<void> {
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
      articleLookupTable: new Map<string, ExternalLink>(),
    };
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');

    const categories = await arraysFromAsync(this.categoryIterator());
    const labels = await arraysFromAsync(this.labelIterator());
    const documents = await arraysFromAsync(this.documentIterator());

    const data = {
      categories,
      labels,
      documents,
      articleLookupTable: this.context?.articleLookupTable,
    };

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Labels loaded: ' + data.labels.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    for await (const article of this.adapter!.articleIterator()) {
      [
        ...(article.published?.variations || []),
        ...(article.draft?.variations || []),
      ].forEach((variation) => {
        this.context!.articleLookupTable.set(`${article.id}#${variation.id}`, {
          externalDocumentId: article.id ?? undefined,
          externalVariationName: variation.name,
        });
      });

      yield documentMapper(article);
    }
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    for await (const item of this.adapter!.categoryIterator()) {
      yield categoryMapper(item);
    }
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    for await (const item of this.adapter!.labelIterator()) {
      yield labelMapper(item);
    }
  }
}
