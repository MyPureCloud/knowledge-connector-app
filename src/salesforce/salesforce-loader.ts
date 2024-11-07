import { SalesforceAdapter } from './salesforce-adapter.js';
import { ExternalContent } from '../model/external-content.js';
import { articleMapper, categoryMapper } from './content-mapper.js';
import { SalesforceConfig } from './model/salesforce-config.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { getLogger } from '../utils/logger.js';
import { AbstractLoader } from '../pipe/abstract-loader.js';
import { Category, Document, Label } from '../model';
import { SalesforceContext } from './model/salesforce-context.js';
import { SalesforceMapperConfiguration } from './model/salesforce-mapper-configuration.js';
import { LANGUAGE_MAPPING } from './salesforce-language-mapping.js';
import { ExternalLink } from '../model/external-link.js';
import { arraysFromAsync } from '../utils/arrays.js';

/**
 * SalesforceLoader is a specific {@Link Loader} implementation for fetching data from Salesforce's API
 */
export class SalesforceLoader extends AbstractLoader {
  private config: SalesforceConfig = {};
  private adapter?: SalesforceAdapter;
  private context?: SalesforceContext;
  private mapperConfiguration: SalesforceMapperConfiguration | null = null;

  public async initialize(
    config: SalesforceConfig,
    adapters: AdapterPair<SalesforceAdapter, Adapter>,
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
      labelLookupTable: new Map<string, Label>(),
    };
  }

  public async run(_input?: ExternalContent): Promise<ExternalContent> {
    validateNonNull(this.adapter, 'Missing source adapter');
    validateNonNull(this.context, 'Missing context');

    getLogger().info('Fetching data...');

    const labels = await arraysFromAsync(this.labelIterator());
    const documents = await arraysFromAsync(this.documentIterator());

    const data: ExternalContent = {
      labels,
      categories: [],
      documents,
      articleLookupTable: this.context?.articleLookupTable,
    };

    getLogger().info('Labels loaded: ' + data.labels.length);
    getLogger().info('Documents loaded: ' + data.documents.length);

    return data;
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {}

  // Due to structural differences, Salesforce categories will be mapped to labels
  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (!this.shouldLoadLabels()) {
      return;
    }

    for await (const categoryGroup of this.adapter!.categoryIterator()) {
      for (const label of categoryMapper(categoryGroup)) {
        this.context?.labelLookupTable.set(label.externalId!, label);
        yield label;
      }
    }
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    for await (const article of this.adapter!.articleIterator()) {
      const document = articleMapper(
        article,
        this.context!,
        this.getConfiguration(),
      );
      if (article.urlName) {
        this.context!.articleLookupTable.set(article.urlName, {
          externalDocumentId: article.id,
        });
      }
      yield document;
    }
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
}
