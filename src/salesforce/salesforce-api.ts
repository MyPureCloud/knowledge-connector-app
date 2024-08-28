import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';
import { SalesforceResponse } from './model/salesforce-response.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { fetch, fetchImage, Response } from '../utils/web-client.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { URLSearchParams } from 'url';
import { Image } from '../model';
import { validateNonNull } from '../utils/validate-non-null.js';
import { SalesforceAccessTokenResponse } from './model/salesforce-access-token-response.js';
import { LANGUAGE_MAPPING } from './salesforce-language-mapping.js';
import { InvalidCredentialsError } from '../adapter/errors/InvalidCredentialsError';
import { ApiError } from '../adapter/errors/ApiError.js';
import { ErrorCodes } from '../utils/errors/ErrorCodes.js';

export class SalesforceApi {
  private config: SalesforceConfig = {};
  private bearerToken: string = '';
  private instanceUrl: string = '';

  public async initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    this.instanceUrl = config.salesforceBaseUrl || '';
    this.bearerToken = await this.authenticate();
  }

  public async fetchAllArticles(): Promise<SalesforceArticleDetails[]> {
    const filters = this.constructFilters();

    const articleInfos = await this.get<SalesforceArticle>(
      `/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles?${filters}`,
      SalesforceEntityTypes.ARTICLES,
    );

    // Article listing does not contain the body, so fetching them one by one is necessary
    const articlePromises = articleInfos.map((articleInfo) =>
      this.fetchArticleDetails(articleInfo.id),
    );

    return Promise.all(articlePromises);
  }

  public async fetchAllCategories(): Promise<SalesforceCategoryGroup[]> {
    const categoryGroups = await this.fetchCategoryGroups();

    for (const categoryGroup of categoryGroups) {
      for (const topCategory of categoryGroup.topCategories) {
        await this.fillCategoryAncestry(categoryGroup.name, topCategory);
      }
    }

    return categoryGroups;
  }

  private async fillCategoryAncestry(
    categoryGroup: string,
    category: SalesforceCategory,
  ): Promise<void> {
    const response = await this.fetchCategory(categoryGroup, category.name);
    category.childCategories = response.childCategories;

    if (
      category.childCategories == null ||
      category.childCategories.length == 0
    ) {
      return;
    }

    for (const child of category.childCategories) {
      await this.fillCategoryAncestry(categoryGroup, child);
    }
  }

  private async fetchCategory(
    categoryGroup: string,
    categoryName: string,
  ): Promise<SalesforceCategory> {
    const url = `${this.instanceUrl}/services/data/${this.config.salesforceApiVersion}/support/dataCategoryGroups/${categoryGroup}/dataCategories/${categoryName}?sObjectName=KnowledgeArticleVersion`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    return (await response.json()) as SalesforceCategory;
  }

  public fetchCategoryGroups(): Promise<SalesforceCategoryGroup[]> {
    return this.get<SalesforceCategoryGroup>(
      `/services/data/${this.config.salesforceApiVersion}/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion`,
      SalesforceEntityTypes.CATEGORY_GROUPS,
    );
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

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', this.config.salesforceClientId!);
    bodyParams.append('client_secret', this.config.salesforceClientSecret!);
    bodyParams.append('username', this.config.salesforceUsername!);
    bodyParams.append('password', this.config.salesforcePassword!);

    const response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      body: bodyParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      return Promise.reject(
        new InvalidCredentialsError(
          ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR.toString().toLowerCase(),
          `Failed to get Salesforce bearer token. Response: ${await response.text()}`,
        ),
      );
    }

    const data: SalesforceAccessTokenResponse =
      (await response.json()) as SalesforceAccessTokenResponse;

    validateNonNull(
      data.access_token,
      `Access token not found in the response: ${JSON.stringify(data)}`,
    );
    validateNonNull(
      data.instance_url,
      `Instance URL not found in the response: ${JSON.stringify(data)}`,
    );

    this.instanceUrl = data.instance_url;

    return data.access_token;
  }

  private async fetchArticleDetails(
    articleId: string,
  ): Promise<SalesforceArticleDetails> {
    const url = `${this.instanceUrl}/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles/${articleId}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    return (await response.json()) as SalesforceArticleDetails;
  }

  private get<T>(
    endpoint: string,
    property: SalesforceEntityTypes,
  ): Promise<T[]> {
    return this.getPage(`${this.instanceUrl}${endpoint}`, property);
  }

  private async getPage<T>(
    url: string,
    property: SalesforceEntityTypes,
  ): Promise<T[]> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    const json = (await response.json()) as SalesforceResponse;
    let list = json[property] as T[];
    if (json.nextPageUrl) {
      const tail = await this.get<T>(json.nextPageUrl, property);
      list = list.concat(tail);
    }

    return list;
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

  private async verifyResponse(response: Response, url: string): Promise<void> {
    if (!response.ok) {
      const message = JSON.stringify(await response.json());
      throw new ApiError(
        ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR.toString().toLowerCase(),
        `Api request [${url}] failed with status [${response.status}] and message [${message}]`,
      );
    }
  }

  private constructFilters(): string {
    const filters: string[] = [];
    if (this.config.salesforceChannel) {
      filters.push(`channel=${this.config.salesforceChannel}`);
    }
    if (this.config.salesforceCategories) {
      filters.push(`categories=${this.config.salesforceCategories}`);
    }

    return filters.join('&');
  }
}
