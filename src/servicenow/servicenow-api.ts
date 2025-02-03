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
import { Pager } from '../utils/pager.js';
import { getLogger } from '../utils/logger.js';
import {
  ServiceNowSingleArticle,
  ServiceNowSingleArticleResponse,
} from './model/servicenow-single-article-response.js';

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
    this.baseUrl = removeTrailingSlash(this.config.servicenowBaseUrl ?? '');

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

    const pager = new Pager(this.apiContext.categories.unprocessed, () =>
      this.fetchNextCategoryPage(),
    );

    for await (const item of pager.fetch()) {
      yield item;
    }

    this.apiContext.categories.done = true;
  }

  public async *articleIterator(): AsyncGenerator<
    ServiceNowArticle,
    void,
    void
  > {
    if (this.apiContext.articles.done) {
      return;
    }

    const pager = new Pager(this.apiContext.articles.unprocessed, () =>
      this.fetchNextArticlePage(),
    );

    for await (const item of pager.fetch()) {
      yield item;
    }

    this.apiContext.articles.done = true;
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

  public async getArticle(id: string): Promise<ServiceNowSingleArticle | null> {
    const url = `${this.baseUrl}/api/sn_km_api/knowledge/articles/${id}`;
    try {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      const json: ServiceNowSingleArticleResponse =
        await readResponse<ServiceNowSingleArticleResponse>(url, response);

      if (!json.result?.number) {
        // Article not found
        return null;
      }

      return json.result;
    } catch (error) {
      getLogger().error(`Failed to fetch article ${id}`, error as Error);
    }

    return null;
  }

  private async fetchNextArticlePage(): Promise<ServiceNowArticle[] | null> {
    const url: string | null = this.constructArticleUrl(
      this.apiContext.articles.nextOffset,
    );
    if (!url) {
      return null;
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    const json: ServiceNowArticleResponse =
      await readResponse<ServiceNowArticleResponse>(url, response);
    const list = json.result.articles;

    getLogger().debug(
      `fetchNextArticlePage - count: ${json.result.meta.count}, end: ${json.result.meta.end}`,
    );
    this.apiContext.articles.nextOffset =
      json.result.meta.count > json.result.meta.end
        ? json.result.meta.end
        : null;

    return list;
  }

  private async fetchNextCategoryPage(): Promise<ServiceNowCategory[] | null> {
    const url: string | null = this.constructCategoryUrl(
      this.apiContext.categories.nextOffset,
    );
    if (!url) {
      return null;
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    const json: ServiceNowCategoryResponse =
      await readResponse<ServiceNowCategoryResponse>(url, response);
    const list = json.result;

    getLogger().debug(
      `fetchNextCategoryPage - offset: ${this.apiContext.categories.nextOffset}`,
    );
    this.apiContext.categories.nextOffset =
      list.length > 0
        ? this.apiContext.categories.nextOffset! + list.length
        : null;

    return list;
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

  private constructArticleUrl(offset: number | null): string | null {
    const endpoint = `/api/sn_km_api/knowledge/articles?fields=kb_category,text,workflow_state,topic,category&${this.queryParams()}&limit=${this.limit}`;
    return offset !== null
      ? `${this.baseUrl}${endpoint}&offset=${offset}`
      : null;
  }

  private constructCategoryUrl(offset: number | null): string | null {
    const endpoint = `/api/now/table/kb_category?sysparm_fields=sys_id,full_category&active=true&sysparm_query=parent_id!%3Dundefined&sysparm_limit=${this.limit}`;
    return offset !== null
      ? `${this.baseUrl}${endpoint}&sysparm_offset=${offset}`
      : null;
  }
}
