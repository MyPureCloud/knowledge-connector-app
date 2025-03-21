import { ServiceNowAdapter } from './servicenow-adapter.js';
import { articleMapper, categoryMapper } from './content-mapper.js';
import { ServiceNowConfig } from './model/servicenow-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { Category, Document, Label } from '../model';
import { ServiceNowContext } from './model/servicenow-context.js';
import { ServiceNowMapperConfiguration } from './model/servicenow-mapper-configuration.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowArticle } from './model/servicenow-article.js';

/**
 * ServiceNow is a specific {@Link Loader} implementation for fetching data from ServiceNow API
 */
export class ServiceNowLoader extends AbstractLoader<ServiceNowContext> {
  private config: ServiceNowConfig = {};
  private adapter?: ServiceNowAdapter;
  private mapperConfiguration: ServiceNowMapperConfiguration | null = null;

  public async initialize(
    config: ServiceNowConfig,
    adapters: AdapterPair<ServiceNowAdapter, Adapter>,
    context: ServiceNowContext,
  ): Promise<void> {
    await super.initialize(config, adapters, context);

    this.config = config;
    this.adapter = adapters.sourceAdapter;

    if (!this.context!.categoryLookupTable) {
      this.context!.categoryLookupTable = {};
    }
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    yield* this.loadItems<ServiceNowCategory, Category>(
      this.adapter!.categoryIterator(),
      (item: ServiceNowCategory): Category[] => {
        this.addCategoryToLookupTable(item);

        return categoryMapper(item, this.context!);
      },
      this.context!.adapter.unprocessedItems.categories,
    );
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {}

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    yield* this.loadItems<ServiceNowArticle, Document>(
      this.adapter!.articleIterator(),
      (item: ServiceNowArticle): Document[] => {
        this.addArticleToLookupTable(item);

        return articleMapper(item, this.getConfiguration(), this.context!);
      },
      this.context!.adapter.unprocessedItems.articles,
    );
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

  private addCategoryToLookupTable(category: ServiceNowCategory): void {
    const { sys_id: id, full_category: name } = category;

    this.context!.categoryLookupTable[category.sys_id] = {
      id: null,
      externalId: id,
      name,
    };
  }

  private addArticleToLookupTable(article: ServiceNowArticle): void {
    const articleLookupTable = this.context!.articleLookupTable;

    articleLookupTable[article.number] = {
      externalDocumentId: `${article.number}`,
      externalDocumentIdAlternatives: [`${article.id}`],
    };
    articleLookupTable[article.id] = {
      externalDocumentId: `${article.number}`,
      externalDocumentIdAlternatives: [`${article.id}`],
    };
    if (article.id?.includes(':')) {
      articleLookupTable[article.id.split(':')[1]] = {
        externalDocumentId: `${article.number}`,
        externalDocumentIdAlternatives: [`${article.id}`],
      };
    }
  }
}
