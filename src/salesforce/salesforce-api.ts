import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';
import { SalesforceResponse } from './model/salesforce-response.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { fetch, fetchImage, readResponse } from '../utils/web-client.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { URLSearchParams } from 'url';
import { Image } from '../model';
import { validateNonNull } from '../utils/validate-non-null.js';
import { SalesforceAccessTokenResponse } from './model/salesforce-access-token-response.js';
import { LANGUAGE_MAPPING } from './salesforce-language-mapping.js';
import { InvalidCredentialsError } from '../adapter/errors/invalid-credentials-error.js';
import { ApiError } from '../adapter/errors/api-error.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { getLogger } from '../utils/logger.js';
import {
  SalesforceApiContext,
  SalesforceContext,
  SalesforceSectionContext,
} from './model/salesforce-context.js';
import { setIfMissing } from '../utils/objects.js';

export class SalesforceApi {
  private config: SalesforceConfig = {};
  private bearerToken: string = '';
  private instanceUrl: string = '';
  private apiContext: SalesforceApiContext = {
    [SalesforceEntityTypes.CATEGORY_GROUPS]: {
      done: false,
      started: false,
      nextUrl: '',
      unprocessed: [],
    },
    [SalesforceEntityTypes.ARTICLES]: {
      done: false,
      started: false,
      nextUrl: '',
      unprocessed: [],
    },
  };

  public async initialize(
    config: SalesforceConfig,
    context: SalesforceContext,
  ): Promise<void> {
    this.config = config;
    this.instanceUrl = removeTrailingSlash(config.salesforceBaseUrl || '');
    this.bearerToken = await this.authenticate();

    this.apiContext = setIfMissing(context, 'api', this.apiContext);
  }

  public async *articleIterator(): AsyncGenerator<
    SalesforceArticleDetails,
    void,
    void
  > {
    if (this.apiContext[SalesforceEntityTypes.ARTICLES].done) {
      return;
    }

    const filters = this.constructFilters();

    const articleInfos = this.getPage<SalesforceArticle>(
      `/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles?${filters}`,
      SalesforceEntityTypes.ARTICLES,
      this.apiContext[SalesforceEntityTypes.ARTICLES],
    );

    // Article listing does not contain the body, so fetching them one by one is necessary
    for await (const articleInfo of articleInfos) {
      yield await this.fetchArticleDetails(articleInfo.id);
    }
  }

  public async *categoryIterator(): AsyncGenerator<
    SalesforceCategoryGroup,
    void,
    void
  > {
    if (this.apiContext[SalesforceEntityTypes.CATEGORY_GROUPS].done) {
      return;
    }

    for await (const categoryGroup of this.fetchCategoryGroups()) {
      for (const topCategory of categoryGroup.topCategories) {
        await this.fillCategoryAncestry(categoryGroup.name, topCategory);
      }
      yield categoryGroup;
    }
  }

  public getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    return fetchImage(
      `${this.instanceUrl}/services/data/${this.config.salesforceApiVersion}/sobjects/knowledge__kav${url}`,
      {
        Authorization: 'Bearer ' + this.bearerToken,
      },
    );
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.instanceUrl);
  }

  private async fillCategoryAncestry(
    categoryGroupName: string,
    category: SalesforceCategory,
  ): Promise<SalesforceCategory> {
    const response = await this.fetchCategory(categoryGroupName, category.name);
    category.childCategories = response.childCategories;

    if (
      category.childCategories != null &&
      category.childCategories.length > 0
    ) {
      for (const child of category.childCategories) {
        await this.fillCategoryAncestry(categoryGroupName, child);
      }
    }

    return category;
  }

  private async fetchCategory(
    categoryGroup: string,
    categoryName: string,
  ): Promise<SalesforceCategory> {
    const url = `${this.instanceUrl}/services/data/${this.config.salesforceApiVersion}/support/dataCategoryGroups/${categoryGroup}/dataCategories/${categoryName}?sObjectName=KnowledgeArticleVersion`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    return readResponse<SalesforceCategory>(url, response);
  }

  private async *fetchCategoryGroups(): AsyncGenerator<
    SalesforceCategoryGroup,
    void,
    void
  > {
    yield* this.getPage<SalesforceCategoryGroup>(
      `/services/data/${this.config.salesforceApiVersion}/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion`,
      SalesforceEntityTypes.CATEGORY_GROUPS,
      this.apiContext[SalesforceEntityTypes.CATEGORY_GROUPS],
    );
  }

  private async authenticate(): Promise<string> {
    validateNonNull(
      this.config.salesforceClientId,
      'Missing SALESFORCE_CLIENT_ID from config',
    );
    validateNonNull(
      this.config.salesforceClientSecret,
      'Missing SALESFORCE_CLIENT_SECRET from config',
    );
    validateNonNull(
      this.config.salesforceUsername,
      'Missing SALESFORCE_USERNAME from config',
    );
    validateNonNull(
      this.config.salesforcePassword,
      'Missing SALESFORCE_PASSWORD from config',
    );

    const loginUrl =
      this.config.salesforceLoginUrl || this.config.salesforceBaseUrl;
    const processedLoginUrl = removeTrailingSlash(loginUrl || '');

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', this.config.salesforceClientId!);
    bodyParams.append('client_secret', this.config.salesforceClientSecret!);
    bodyParams.append('username', this.config.salesforceUsername!);
    bodyParams.append('password', this.config.salesforcePassword!);

    const url = `${processedLoginUrl}/services/oauth2/token`;
    const response = await fetch(url, {
      method: 'POST',
      body: bodyParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    let data;
    try {
      data = await readResponse<SalesforceAccessTokenResponse>(url, response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new InvalidCredentialsError(
          `Failed to get Salesforce bearer token. Reason: ${error.message}`,
          error.getDetails(),
        );
      }
      throw new InvalidCredentialsError(
        `Failed to get Salesforce bearer token. Reason: ${error}`,
        { status: response.status, message: error },
      );
    }

    validateNonNull(
      data.access_token,
      `Access token not found in the response: ${JSON.stringify(data)}`,
    );
    validateNonNull(
      data.instance_url,
      `Instance URL not found in the response: ${JSON.stringify(data)}`,
    );

    this.instanceUrl = removeTrailingSlash(data.instance_url);

    return data.access_token;
  }

  private async fetchArticleDetails(
    articleId: string,
  ): Promise<SalesforceArticleDetails> {
    const url = `${this.instanceUrl}/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles/${articleId}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    return readResponse<SalesforceArticleDetails>(url, response);
  }

  private async *getPage<T>(
    endpoint: string,
    property: SalesforceEntityTypes,
    context: SalesforceSectionContext<T>,
  ): AsyncGenerator<T, void, void> {
    if (context.unprocessed.length) {
      getLogger().debug(
        `Processing unprocessed item ${context.unprocessed.length}`,
      ); // TODO
      for await (const item of this.processList<T>(context.unprocessed)) {
        yield item;
      }
      getLogger().debug(`Processing unprocessed item finished`); // TODO
    }

    const headers = this.buildHeaders();
    let url: string | null = this.apiContext[property].nextUrl;
    if (!context.started) {
      url = `${this.instanceUrl}${endpoint}`;
      context.started = true;
    }

    while (url) {
      getLogger().debug(`Fetching page ${url}`); // TODO
      const response = await fetch(url, {
        headers,
      });

      const json: SalesforceResponse = await readResponse<SalesforceResponse>(
        url,
        response,
      );
      const list = json[property] as T[];

      url = json.nextPageUrl ? `${this.instanceUrl}${json.nextPageUrl}` : null;
      context.unprocessed = list;
      context.nextUrl = url;

      getLogger().debug(`Loaded articles ${list.length}`); // TODO
      for await (const item of this.processList(context.unprocessed)) {
        yield item;
      }
      getLogger().debug(`Loaded articles finished`); // TODO
    }

    context.done = true;
  }

  private buildHeaders() {
    validateNonNull(
      this.config.salesforceLanguageCode,
      'Missing SALESFORCE_LANGUAGE_CODE from config',
    );

    if (this.config.salesforceLanguageCode!.length > 2) {
      const language =
        LANGUAGE_MAPPING[this.config.salesforceLanguageCode!] ??
        this.config.salesforceLanguageCode!;
      return {
        Authorization: 'Bearer ' + this.bearerToken,
        'Accept-Language': language,
      };
    }

    return {
      Authorization: 'Bearer ' + this.bearerToken,
      'Accept-Language': this.config.salesforceLanguageCode!,
    };
  }

  private constructFilters(): string {
    const filters: string[] = [];
    if (this.config.salesforceChannel) {
      filters.push(`channel=${this.config.salesforceChannel}`);
    }
    if (this.config.salesforceCategories) {
      filters.push(`categories=${this.config.salesforceCategories}`);
      filters.push('queryMethod=BELOW');
    }

    return filters.join('&');
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
