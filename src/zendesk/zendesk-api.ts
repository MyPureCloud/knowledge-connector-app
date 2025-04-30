import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskEntityTypes } from './model/zendesk-entity-types.js';
import { ZendeskResponse } from './model/zendesk-response.js';
import { ZendeskArticleAttachment } from './model/zendest-article-attachment.js';
import { ZendeskSection } from './model/zendesk-section.js';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { fetchSourceResource } from '../utils/web-client.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { setIfMissing } from '../utils/objects.js';
import {
  ZendeskApiContext,
  ZendeskContext,
  ZendeskSectionContext,
} from './model/zendesk-context.js';
import { Pager } from '../utils/pager.js';
import { EntityType } from '../model/entity-type.js';
import { ContentType } from '../utils/content-type.js';
import { RequestInit } from 'undici';

export class ZendeskApi {
  private config: ZendeskConfig = {};
  private baseUrl: string = '';
  private apiContext: ZendeskApiContext = {
    [ZendeskEntityTypes.CATEGORIES]: {
      done: false,
      started: false,
      nextUrl: null,
      unprocessed: [],
    },
    [ZendeskEntityTypes.SECTIONS]: {
      done: false,
      started: false,
      nextUrl: null,
      unprocessed: [],
    },
    [ZendeskEntityTypes.LABELS]: {
      done: false,
      started: false,
      nextUrl: null,
      unprocessed: [],
    },
    [ZendeskEntityTypes.ARTICLES]: {
      done: false,
      started: false,
      nextUrl: null,
      unprocessed: [],
    },
    [ZendeskEntityTypes.ARTICLE_ATTACHMENTS]: {
      done: false,
      started: false,
      nextUrl: null,
      unprocessed: [],
    },
  };

  public async initialize(
    config: ZendeskConfig,
    context: ZendeskContext,
  ): Promise<void> {
    this.config = config;
    this.baseUrl = removeTrailingSlash(config.zendeskBaseUrl || '');

    this.apiContext = setIfMissing(context, 'api', this.apiContext);
  }

  public async *categoryIterator(): AsyncGenerator<ZendeskSection, void, void> {
    if (!this.apiContext[ZendeskEntityTypes.CATEGORIES].done) {
      for await (const item of this.getAllPages<ZendeskSection>(
        `/api/v2/help_center/${this.config.zendeskLocale}/categories`,
        ZendeskEntityTypes.CATEGORIES,
        this.apiContext[ZendeskEntityTypes.CATEGORIES],
      )) {
        yield item;
      }
    }

    if (!this.apiContext[ZendeskEntityTypes.SECTIONS].done) {
      for await (const item of this.getAllPages<ZendeskSection>(
        `/api/v2/help_center/${this.config.zendeskLocale}/sections`,
        ZendeskEntityTypes.SECTIONS,
        this.apiContext[ZendeskEntityTypes.SECTIONS],
      )) {
        yield item;
      }
    }
  }

  public async *labelIterator(): AsyncGenerator<ZendeskLabel, void, void> {
    if (this.apiContext[ZendeskEntityTypes.LABELS].done) {
      return;
    }

    yield* this.getAllPages<ZendeskLabel>(
      `/api/v2/help_center/articles/labels`,
      ZendeskEntityTypes.LABELS,
      this.apiContext[ZendeskEntityTypes.LABELS],
    );
  }

  public async *articleIterator(): AsyncGenerator<ZendeskArticle, void, void> {
    if (this.apiContext[ZendeskEntityTypes.ARTICLES].done) {
      return;
    }

    yield* this.getAllPages<ZendeskArticle>(
      `/api/v2/help_center/${this.config.zendeskLocale}/articles`,
      ZendeskEntityTypes.ARTICLES,
      this.apiContext[ZendeskEntityTypes.ARTICLES],
    );
  }

  public async *attachmentInfoListForArticleIterator(
    articleId: string,
  ): AsyncGenerator<ZendeskArticleAttachment, void, void> {
    if (this.apiContext[ZendeskEntityTypes.ARTICLE_ATTACHMENTS].done) {
      return;
    }

    yield* this.getAllPages<ZendeskArticleAttachment>(
      `/api/v2/help_center/${this.config.zendeskLocale}/articles/${articleId}/attachments/inline`,
      ZendeskEntityTypes.ARTICLE_ATTACHMENTS,
      this.apiContext[ZendeskEntityTypes.ARTICLE_ATTACHMENTS],
    );
  }

  public async downloadAttachment(url: string): Promise<Blob> {
    return fetchSourceResource<Blob>(
      url,
      this.buildRequestInit(),
      EntityType.DOCUMENT,
      ContentType.BLOB,
    );
  }

  public getInstanceUrl(): string {
    return removeTrailingSlash(this.config.zendeskBaseUrl || '');
  }

  private async *getAllPages<T>(
    endpoint: string,
    property: ZendeskEntityTypes,
    context: ZendeskSectionContext<T>,
  ): AsyncGenerator<T, void, void> {
    if (!context.started) {
      context.nextUrl = `${this.baseUrl}${endpoint}`;
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
    property: ZendeskEntityTypes,
    context: ZendeskSectionContext<T>,
  ): Promise<T[] | null> {
    if (!context.nextUrl) {
      return null;
    }
    const url = context.nextUrl;

    const json = await fetchSourceResource<ZendeskResponse>(
      url,
      this.buildRequestInit(),
      this.toEntityType(property),
    );

    context.nextUrl = json.next_page ? json.next_page : null;

    return json[property] as T[];
  }

  private buildRequestInit(): RequestInit {
    return {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            this.config.zendeskUsername + ':' + this.config.zendeskPassword,
            'utf-8',
          ).toString('base64'),
      },
    }
  }

  private toEntityType(type: ZendeskEntityTypes): EntityType {
    switch (type) {
      case ZendeskEntityTypes.CATEGORIES:
      case ZendeskEntityTypes.SECTIONS:
        return EntityType.CATEGORY;
      case ZendeskEntityTypes.LABELS:
        return EntityType.LABEL;
      default:
        return EntityType.DOCUMENT;
    }
  }
}
