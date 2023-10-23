import { SalesforceConfig } from './model/salesforce-config.js';
import { SalesforceEntityTypes } from './model/salesforce-entity-types.js';
import { SalesforceResponse } from './model/salesforce-response.js';
import { SalesforceArticleAttachment } from './model/salesforce-article-attachment.js';
import { SalesforceSection } from './model/salesforce-section.js';
import { SalesforceArticle } from './model/salesforce-article.js';
import { SalesforceLabel } from './model/salesforce-label.js';
import { fetch, Response } from '../utils/web-client.js';
import { SalesforceIndividualArticle } from './model/salesforce-individual-article.js';

export class SalesforceApi {
  private config: SalesforceConfig = {};
  private sessionid = '';

  public async initialize(config: SalesforceConfig): Promise<void> {
    this.config = config;
    // prettier-ignore
    await fetch(config.salesforceBaseUrl ? config.salesforceBaseUrl + '/services/Soap/u/50.0' : 'https://login.salesforce.com/services/Soap/u/50.0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate',
          SOAPAction: 'login',
        },
        // prettier-ignore
        body: `<?xml version="1.0" encoding="utf-8" ?> <env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><n1:login xmlns:n1="urn:partner.soap.sforce.com"><n1:username>${config.salesforceUsername}</n1:username><n1:password>${config.salesforcePassword}${config.salesforceSecurityToken}</n1:password></n1:login></env:Body></env:Envelope>`,
      },
    ).then((response) => response.text().then((data) => {
      // prettier-ignore
      this.sessionid = data.substring(data.indexOf('<sessionId>') + 11, data.lastIndexOf('</sessionId>'))
      console.log(`Token: ${this.sessionid}`)
    }));

    return Promise.resolve(undefined);
  }

  public async fetchAllArticles(): Promise<SalesforceArticle[]> {
    let articles = await this.get<SalesforceArticle>(
        `/services/data/v50.0/support/knowledgeArticles`,
        SalesforceEntityTypes.ARTICLES,
      );
      //To get body need to then get each article then add it
      for (const art of articles) {
        console.log(`ArticleId: ${art.id} number: ${art.articleNumber}`)
        let data = await this.fetchArticle(art.id)
        let existing = articles.find((e) => e.articleNumber === art.articleNumber)
        existing ? existing.body = data[0].layoutItems[0].value : null
      }
      console.log(articles)
      return articles
  }

  public fetchArticle(articleId: string): Promise<SalesforceIndividualArticle[]> {
    return this.get<SalesforceIndividualArticle>(
      `/services/data/v50.0/support/knowledgeArticles/${articleId}`,
      SalesforceEntityTypes.ARTICLE,
    )
  }

  public async fetchAllCategories(): Promise<SalesforceSection[]> {
    const [categories] = await Promise.all([
      this.fetchCategories(),
    ]);
    return categories
  }

  public fetchAllLabels(): Promise<SalesforceLabel[]> {
    return this.get<SalesforceLabel>(
      `/api/v2/help_center/articles/labels`,
      SalesforceEntityTypes.LABELS,
    );
  }

  public fetchAttachmentInfoListForArticle(
    articleId: string,
  ): Promise<SalesforceArticleAttachment[]> {
    return this.get<SalesforceArticleAttachment>(
      `/api/v2/help_center/${this.config.salesforceLocale}/articles/${articleId}/attachments/inline`,
      SalesforceEntityTypes.ARTICLE_ATTACHMENTS,
    );
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);

    return await response.blob();
  }

  private fetchCategories(): Promise<SalesforceSection[]> {
    return this.get<SalesforceSection>(
      `/services/data/v50.0/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion`,
      SalesforceEntityTypes.CATEGORIES,
    );
  }

  private fetchSections(): Promise<SalesforceSection[]> {
    return this.get<SalesforceSection>(
      `/api/v2/help_center/${this.config.salesforceLocale}/sections`,
      SalesforceEntityTypes.SECTIONS,
    );
  }

  private get<T>(endpoint: string, property: SalesforceEntityTypes,): Promise<T[]> {
    return this.getPage(`${this.config.salesforceDomain}${endpoint}`, property);
  }

  private async getPage<T>(
    url: string,
    property: SalesforceEntityTypes,
  ): Promise<T[]> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    await this.verifyResponse(response, url);
    if(property === SalesforceEntityTypes.ARTICLE) {
      const json = (await response.json()) as SalesforceResponse;
      let data = {article: [json]}
      let list = data[property] as T[];
      
      return list
    }

    const json = (await response.json()) as SalesforceResponse;
    let list = json[property] as T[];
    if (json.nextPageUrl) {
      const tail = await this.getPage<T>(json.nextPageUrl, property);
      list = list.concat(tail);
    }
    return list;
  }

  private buildHeaders() {
    return {
      'Accept-language': 'en-us',
      'Authorization': `Bearer ${this.sessionid}`
    }
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
