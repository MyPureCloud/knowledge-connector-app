import { ServiceNowConfig } from './model/servicenow-config.js';
import { ServiceNowArticle } from './model/servicenow-article.js';
import {
  fetch,
  readResponse,
  verifyResponseStatus,
} from '../utils/web-client.js';
import { ServiceNowArticleResponse } from './model/servicenow-article-response.js';
import { ServiceNowArticleAttachment } from './model/servicenow-article-attachment.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { ServiceNowCategory } from './model/servicenow-category.js';
import { ServiceNowCategoryResponse } from './model/servicenow-category-response.js';
import {
  ServiceNowApiContext,
  ServiceNowContext,
} from './model/servicenow-context.js';
import { setIfMissing } from '../utils/objects.js';
import { getLogger } from '../utils/logger.js';

export class ServiceNowApi {
  private config: ServiceNowConfig = {};
  private limit: number = 0;
  private baseUrl: string = '';
  private apiContext: ServiceNowApiContext = {
    categories: {
      done: false,
      nextOffset: 0,
      unprocessed: [],
    },
    articles: {
      done: false,
      nextOffset: 0,
      unprocessed: [],
    },
  };

  public async initialize(
    config: ServiceNowConfig,
    context: ServiceNowContext,
  ): Promise<void> {
    this.config = config;
    this.limit = this.config.limit ? parseInt(this.config.limit, 10) : 50;
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl || '');

    this.apiContext = setIfMissing(context, 'api', this.apiContext);
  }

  public async *categoryIterator(): AsyncGenerator<
    ServiceNowCategory,
    void,
    void
  > {
    if (this.apiContext.categories.done) {
      return;
    }

    yield* this.getCategoryPage(
      `/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined&sysparm_limit=${this.limit}`,
    );
  }

  public async *articleIterator(): AsyncGenerator<
    ServiceNowArticle,
    void,
    void
  > {
    if (this.apiContext.articles.done) {
      return;
    }

    yield* this.getArticlePage(
      `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&${this.queryParams()}&limit=${this.limit}`,
    );
  }

  private async *getArticlePage(
    endpoint: string,
  ): AsyncGenerator<ServiceNowArticle, void, void> {
    getLogger().debug(`getArticlePage`); // TODO
    let offset: number | null = this.apiContext.articles.nextOffset;
    let url: string | null =
      offset !== null ? `${this.baseUrl}${endpoint}&offset=${offset}` : null;

    if (this.apiContext.articles.unprocessed) {
      getLogger().debug(
        `Processing unprocessed item ${this.apiContext.articles.unprocessed.length}`,
      ); // TODO
      for await (const item of this.processList(
        this.apiContext.articles.unprocessed,
      )) {
        yield item;
      }
      getLogger().debug(`Processing unprocessed item finished`); // TODO
    }

    getLogger().debug(`Fetching page ${offset}`); // TODO
    while (url) {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      const json: ServiceNowArticleResponse =
        await readResponse<ServiceNowArticleResponse>(url, response);
      const list = json.result.articles;

      offset =
        json.result.meta.count > json.result.meta.end
          ? json.result.meta.end
          : null;
      url =
        offset !== null ? `${this.baseUrl}${endpoint}&offset=${offset}` : null;

      this.apiContext.articles.unprocessed = list;
      this.apiContext.articles.nextOffset = offset;

      getLogger().debug(`Loaded articles ${list.length}`); // TODO
      for await (const item of this.processList(
        this.apiContext.articles.unprocessed,
      )) {
        yield item;
      }
      getLogger().debug(`Loaded articles finished`); // TODO
    }

    this.apiContext.articles.done = true;
  }

  private async *getCategoryPage(
    endpoint: string,
  ): AsyncGenerator<ServiceNowCategory, void, void> {
    let offset: number | null = this.apiContext.categories.nextOffset;
    let url: string | null =
      offset !== null
        ? `${this.baseUrl}${endpoint}&sysparm_offset=${offset}`
        : null;

    if (this.apiContext.categories.unprocessed) {
      for await (const item of this.processList(
        this.apiContext.categories.unprocessed,
      )) {
        yield item;
      }
    }

    while (url && offset !== null) {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      const json: ServiceNowCategoryResponse =
        await readResponse<ServiceNowCategoryResponse>(url, response);
      const list = json.result;

      offset = list.length > 0 ? offset + list.length : null;
      url = offset
        ? `${this.baseUrl}${endpoint}&sysparm_offset=${offset}`
        : null;

      this.apiContext.categories.unprocessed = list;
      this.apiContext.categories.nextOffset = offset;

      for await (const item of this.processList(list)) {
        yield item;
      }
    }

    this.apiContext.categories.done = true;
  }

  public async fetchAttachmentInfo(
    attachmentId: string,
  ): Promise<ServiceNowArticleAttachment> {
    const url = `${this.baseUrl}/api/now/attachment/${attachmentId}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    return readResponse<ServiceNowArticleAttachment>(url, response);
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await verifyResponseStatus(url, response);

    return await response.blob();
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.servicenowBaseUrl || '');
  }

  private buildHeaders() {
    return {
      Authorization:
        'Basic ' +
        Buffer.from(
          this.config.servicenowUsername + ':' + this.config.servicenowPassword,
          'utf-8',
        ).toString('base64'),
    };
  }

  private queryParams(): string {
    const esc = encodeURIComponent;
    const params: string[] = [];

    if (this.config.servicenowKnowledgeBases) {
      params.push(`kb=${esc(this.config.servicenowKnowledgeBases)}`);
    }

    params.push(
      `filter=${esc(this.buildFilters(this.config.servicenowCategories))}`,
    );

    if (this.config.servicenowLanguage) {
      const language =
        this.config.servicenowLanguage.length > 2
          ? this.config.servicenowLanguage.substring(0, 2)
          : this.config.servicenowLanguage;

      params.push(`language=${esc(language)}`);
    }

    return params.join('&');
  }

  private buildFilters(categories?: string): string {
    const filters: string[] = [];
    filters.push('workflow_state=published');

    if (categories) {
      filters.push(this.buildCategoriesFilter(categories));
    }
    return filters.join('^');
  }

  private buildCategoriesFilter(value: string): string {
    const filters = value.split(',');

    return filters
      .map((f) => f.trim())
      .map((f) => `kb_category=${f}`)
      .join('^OR');
  }

  private async *processList<T>(list: T[]): AsyncGenerator<T, void, void> {
    while (list.length > 0) {
      const item = list.shift();
      const str = JSON.stringify(item);
      getLogger().debug(
        `yield (${list.length} left) ${str.substring(0, Math.min(150, str.length))}`,
      ); // TODO
      yield Promise.resolve(item!);
    }
    getLogger().debug('processList finished'); // TODO
  }
}
