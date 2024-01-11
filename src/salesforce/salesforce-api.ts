import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';
import { SalesforceResponse } from './model/salesforce-response.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { fetch, fetchImage, Response } from '../utils/web-client.js';
import { SalesforceCategoryGroup } from './model/salesforce-category-group.js';
import { SalesforceArticleDetails } from './model/salesforce-article-details.js';
import { SalesforceCategory } from './model/salesforce-category.js';
import { URLSearchParams } from 'url';
import { Image } from '../model/image.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { SalesforceAccessTokenResponse } from './model/salesforce-access-token-response.js';

export class SalesforceApi {
  private config: SalesforceConfig = {};
  private bearerToken: string = '';

  public async initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    this.bearerToken = await this.getBearerToken();
  }

  public async fetchAllArticles(): Promise<SalesforceArticleDetails[]> {
    const articleInfos = await this.get<SalesforceArticle>(
      `/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles`,
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
    const url = `${this.config.salesforceBaseUrl}/services/data/${this.config.salesforceApiVersion}/support/dataCategoryGroups/${categoryGroup}/dataCategories/${categoryName}?sObjectName=KnowledgeArticleVersion`;
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
    return fetchImage(url, {
      Authorization: 'Bearer ' + this.bearerToken,
    });
  }

  private async getBearerToken(): Promise<string> {
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

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', this.config.salesforceClientId!);
    bodyParams.append('client_secret', this.config.salesforceClientSecret!);
    bodyParams.append('username', this.config.salesforceUsername!);
    bodyParams.append('password', this.config.salesforcePassword!);

    const response = await fetch(
      `${this.config.salesforceBaseUrl}/services/oauth2/token`,
      {
        method: 'POST',
        body: bodyParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!response.ok) {
      return Promise.reject(
        new Error(
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

    return data.access_token;
  }

  private async fetchArticleDetails(
    articleId: string,
  ): Promise<SalesforceArticleDetails> {
    const url = `${this.config.salesforceBaseUrl}/services/data/${this.config.salesforceApiVersion}/support/knowledgeArticles/${articleId}`;
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
    return this.getPage(
      `${this.config.salesforceBaseUrl}${endpoint}`,
      property,
    );
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
      const tail = await this.getPage<T>(json.nextPageUrl, property);
      list = list.concat(tail);
    }

    return list;
  }

  private buildHeaders() {
    validateNonNull(
      this.config.salesforceLanguageCode,
      'Missing SALESFORCE_LANGUAGE_CODE from config',
    );
    return {
      Authorization: 'Bearer ' + this.bearerToken,
      'Accept-language': this.config.salesforceLanguageCode!,
    };
  }

  private async verifyResponse(response: Response, url: string): Promise<void> {
    if (!response.ok) {
      const message = JSON.stringify(await response.json());
      throw new Error(
        `Api request [${url}] failed with status [${response.status}] and message [${message}]`,
      );
    }
  }
}
