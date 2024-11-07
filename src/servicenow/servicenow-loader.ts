import { ServiceNowAdapter } from './servicenow-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { articleMapper, categoryMapper } from './content-mapper.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { ExternalLink } from '../model/external-link.js';
import { Category, Document, Label } from '../model';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowMapperConfiguration } from './model/servicenow-mapper-configuration.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { arraysFromAsync } from '../utils/arrays.js';

/**
 * ServiceNow is a specific {@Link Loader} implementation for fetching data from ServiceNow API
 */
export class ServiceNowLoader extends AbstractLoader {
  private config: ServiceNowConfig = {};
  private adapter?: ServiceNowAdapter;
  private context?: ServiceNowContext;
  private mapperConfiguration: ServiceNowMapperConfiguration | null = null;

  public async initialize(
    config: ServiceNowConfig,
    adapters: AdapterPair<ServiceNowAdapter, Adapter>,
  ): Promise<void> {
    await super.initialize(config, adapters);

    this.config = config;
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
      categoryLookupTable: new Map<string, ServiceNowCategory>(),
    };
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');

    getLogger().info('Fetching data...');

    const categories = await arraysFromAsync(this.categoryIterator());
    const documents = await arraysFromAsync(this.documentIterator());

    const data: ExternalContent = {
      labels: [],
      categories,
      documents,
      articleLookupTable: this.context?.articleLookupTable,
    };

    getLogger().info('Categories loaded: ' + data.categories.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    for await (const item of this.adapter!.categoryIterator()) {
      this.context!.categoryLookupTable.set(item.sys_id, item);

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

  public async *labelIterator(): AsyncGenerator<Label, void, void> {}

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    for await (const article of this.adapter!.articleIterator()) {
      const document = articleMapper(article, this.getConfiguration());

      if (article.id) {
        if (article.number) {
          this.context!.articleLookupTable.set(article.number, {
            externalDocumentId: article.id,
          });
        }
        this.context!.articleLookupTable.set(article.id.split(':')[1], {
          externalDocumentId: article.id,
        });
      }

      yield document;
    }
  }

  private getConfiguration(): ServiceNowMapperConfiguration {
    if (!this.mapperConfiguration) {
      const fetchCategories = this.shouldLoadCategories();
      const buildExternalUrls = this.shouldBuildExternalUrls();
      const baseUrl = this.config.servicenowBaseUrl!;

      this.mapperConfiguration = {
        fetchCategories,
        buildExternalUrls,
        baseUrl,
      };
    }

    return this.mapperConfiguration;
  }
}
