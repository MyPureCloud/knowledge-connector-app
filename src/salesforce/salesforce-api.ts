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
import {
  SalesforceApiContext,
  SalesforceContext,
  SalesforceSectionContext,
} from './model/salesforce-context.js';
import { setIfMissing } from '../utils/objects.js';
import { Pager } from '../utils/pager.js';
import { catcher } from '../utils/catch-error-helper.js';
import { Interrupted } from '../utils/errors/interrupted.js';

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
    const articlesContext = this.apiContext[SalesforceEntityTypes.ARTICLES];

    const articleInfos = this.getAllPages<SalesforceArticle>(
      `/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles?${filters}`,
      SalesforceEntityTypes.ARTICLES,
      articlesContext,
    );

    // Article listing does not contain the body, so fetching them one by one is necessary
    for await (const articleInfo of articleInfos) {
      try {
        yield await this.fetchArticleDetails(articleInfo.id);
      } catch (error) {
        await catcher()
          .on(Interrupted, (error) => {
            articlesContext.unprocessed.unshift(articleInfo);
            throw error;
          })
          .with(error);
      }
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
    yield* this.getAllPages<SalesforceCategoryGroup>(
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
        throw InvalidCredentialsError.fromApiError(
          `Failed to get Salesforce bearer token. Reason: ${error.message}`,
          error,
        );
      }
      throw new InvalidCredentialsError(
        `Failed to get Salesforce bearer token. Reason: ${error}`,
        { messageParams: { status: response.status, message: error } },
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

  private async *getAllPages<T>(
    endpoint: string,
    property: SalesforceEntityTypes,
    context: SalesforceSectionContext<T>,
  ): AsyncGenerator<T, void, void> {
    if (!context.started) {
      context.nextUrl = `${this.instanceUrl}${endpoint}`;
      context.started = true;
    }

    const pager = new Pager<T>(context.unprocessed, () =>
      this.fetchNextPage(property, context),
    );

    for await (const item of pager.fetch()) {
      yield item;
    }

    context.done = true;
  }

  private async fetchNextPage<T>(
    property: SalesforceEntityTypes,
    context: SalesforceSectionContext<T>,
  ): Promise<T[] | null> {
    if (!context.nextUrl) {
      return null;
    }
    const url = context.nextUrl;

    const headers = this.buildHeaders();
    const response = await fetch(url, {
      headers,
    });

    const json: SalesforceResponse = await readResponse<SalesforceResponse>(
      url,
      response,
    );

    context.nextUrl = json.nextPageUrl
      ? `${this.instanceUrl}${json.nextPageUrl}`
      : null;

    return json[property] as T[];
  }

  private buildHeaders() {
    const languageCode = validateNonNull(
      this.config.salesforceLanguageCode,
      'Missing SALESFORCE_LANGUAGE_CODE from config',
    );

    const language = LANGUAGE_MAPPING[languageCode] || languageCode;

    return {
      Authorization: 'Bearer ' + this.bearerToken,
      'Accept-Language': language,
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
}
