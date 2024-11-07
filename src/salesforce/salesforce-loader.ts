import { SalesforceAdapter } from './salesforce-adapter.js';
import { articleMapper, categoryMapper } from './content-mapper.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { Category, Document, Label } from '../model';
import { SalesforceContext } from './model/salesforce-context.js';
import { SalesforceMapperConfiguration } from './model/salesforce-mapper-configuration.js';
import { LANGUAGE_MAPPING } from './salesforce-language-mapping.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';

/**
 * SalesforceLoader is a specific {@Link Loader} implementation for fetching data from Salesforce's API
 */
export class SalesforceLoader extends AbstractLoader<SalesforceContext> {
  private config: SalesforceConfig = {};
  private adapter?: SalesforceAdapter;
  private mapperConfiguration: SalesforceMapperConfiguration | null = null;

  public async initialize(
    config: SalesforceConfig,
    adapters: AdapterPair<SalesforceAdapter, Adapter>,
    context: SalesforceContext,
  ): Promise<void> {
    await super.initialize(config, adapters, context);

    this.config = config;
    this.adapter = adapters.sourceAdapter;
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {}

  // Due to structural differences, Salesforce categories will be mapped to labels
  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (!this.shouldLoadLabels()) {
      return;
    }

    yield* this.loadItems<SalesforceCategoryGroup, Label>(
      this.adapter!.categoryIterator(),
      (item: SalesforceCategoryGroup): Label[] => {
        const labels = categoryMapper(item);
        this.addLabelsToLookupTable(labels);

        return labels;
      },
      this.context!.adapter.unprocessedItems.categories,
    );
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    yield* this.loadItems<SalesforceArticleDetails, Document>(
      this.adapter!.articleIterator(),
      (item: SalesforceArticleDetails): Document[] => {
        const documents = articleMapper(
          item,
          this.context!,
          this.getConfiguration(),
        );
        this.addArticleToLookupTable(item);

        return documents;
      },
      this.context!.adapter.unprocessedItems.articles,
    );
  }

  private getConfiguration(): SalesforceMapperConfiguration {
    if (!this.mapperConfiguration) {
      const fetchLabels = this.shouldLoadLabels();
      const buildExternalUrls = this.shouldBuildExternalUrls();
      const languageCode = this.mapLanguageCode();
      const contentFields = this.getContentFieldList();
      const baseUrl = this.adapter!.getResourceBaseUrl();

      this.mapperConfiguration = {
        fetchLabels,
        buildExternalUrls,
        languageCode,
        contentFields,
        baseUrl,
      };
    }

    return this.mapperConfiguration;
  }

  private mapLanguageCode(): string {
    validateNonNull(
      this.config.salesforceLanguageCode,
      'Missing SALESFORCE_LANGUAGE_CODE from config',
    );

    let languageCode = this.config.salesforceLanguageCode!;
    if (languageCode.length > 2) {
      languageCode = LANGUAGE_MAPPING[languageCode] ?? languageCode;
    }

    return languageCode
      .replace('-', '_')
      .replace(/_([a-z]{2})$/, (_, p1) => `_${p1.toUpperCase()}`);
  }

  private getContentFieldList(): string[] {
    return (this.config.salesforceArticleContentFields?.split(',') || [])
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  private addLabelsToLookupTable(labels: Label[]): void {
    labels.forEach((label) => {
      this.context!.labelLookupTable[label.externalId!] = label;
    });
  }

  private addArticleToLookupTable(article: SalesforceArticleDetails): void {
    if (article.urlName) {
      this.context!.articleLookupTable[article.urlName] = {
        externalDocumentId: article.id,
      };
    }
  }
}
