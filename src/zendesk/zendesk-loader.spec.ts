import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Adapter } from '../adapter/adapter.js';
import { Image } from '../model';
import { ZendeskArticle } from './model/zendesk-article.js';
import { ZendeskCategory } from './model/zendesk-category.js';
import { ZendeskLabel } from './model/zendesk-label.js';
import { ZendeskConfig } from './model/zendesk-config.js';
import { ZendeskAdapter } from './zendesk-adapter.js';
import { ZendeskLoader } from './zendesk-loader.js';
import {
  generateNormalizedCategory,
  generateNormalizedLabel,
  generateRawDocument,
} from '../tests/utils/entity-generators.js';

const mockGetAttachment =
  jest.fn<(articleId: string | null, url: string) => Promise<Image | null>>();
const mockCategoryIterator =
  jest.fn<() => AsyncGenerator<ZendeskCategory, void, void>>();
const mockLabelIterator =
  jest.fn<() => AsyncGenerator<ZendeskLabel, void, void>>();
const mockArticleIterator =
  jest.fn<() => AsyncGenerator<ZendeskArticle, void, void>>();

const CATEGORY_EXTERNAL_ID = 'category-external-id';
const CATEGORY_NAME = 'category-name';

describe('ZendeskLoader', () => {
  const LABEL = generateNormalizedLabel('', null, 'label-name');
  const CATEGORY = generateNormalizedCategory(
    '',
    null,
    CATEGORY_NAME,
    CATEGORY_EXTERNAL_ID,
  );
  const DOCUMENT = generateRawDocument(
    'article-body',
    {
      id: CATEGORY_EXTERNAL_ID,
      name: CATEGORY_NAME,
    },
    [
      {
        id: null,
        name: 'label-name',
      },
    ],
  );

  let config: ZendeskConfig;
  let adapter: ZendeskAdapter;
  let loader: ZendeskLoader;

  beforeEach(async () => {
    config = {};
    adapter = new ZendeskAdapter();
    loader = new ZendeskLoader();

    mockArticleIterator.mockImplementation(articleIterator);
    mockCategoryIterator.mockImplementation(categoryIterator);
    mockLabelIterator.mockImplementation(labelIterator);
  });

  describe('run', () => {
    beforeEach(async () => {
      await loader.initialize(config, {
        sourceAdapter: adapter,
        destinationAdapter: {} as Adapter,
      });
    });

    it('should map label', async () => {
      const { value: result } = await loader.labelIterator().next();
      expect(result).toEqual(LABEL);
    });

    it('should map category', async () => {
      const { value: result } = await loader.categoryIterator().next();
      expect(result).toEqual(CATEGORY);
    });

    it('should map articles', async () => {
      await loader.categoryIterator().next();
      const { value } = await loader.documentIterator().next();
      expect(value).toEqual(DOCUMENT);
    });

    describe('when categories excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchCategories: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave categories empty', async () => {
        const { value: result } = await loader.categoryIterator().next();
        expect(result).toBeUndefined();
      });
    });

    describe('when labels excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchLabels: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave labels empty', async () => {
        const { value: result } = await loader.labelIterator().next();
        expect(result).toBeUndefined();
      });
    });

    describe('when articles excluded', () => {
      beforeEach(async () => {
        await loader.initialize(
          { ...config, fetchArticles: 'false' },
          {
            sourceAdapter: adapter,
            destinationAdapter: {} as Adapter,
          },
        );
      });

      it('should leave documents empty', async () => {
        const { value: result } = await loader.documentIterator().next();
        expect(result).toBeUndefined();
      });
    });
  });
});

jest.mock('./zendesk-adapter.js', () => {
  return {
    ZendeskAdapter: jest.fn().mockImplementation(() => {
      return {
        initialise: jest.fn<(config: ZendeskConfig) => Promise<void>>(),
        categoryIterator: () => mockCategoryIterator(),
        labelIterator: () => mockLabelIterator(),
        articleIterator: () => mockArticleIterator(),
        getAttachment: (articleId: string | null, url: string) =>
          mockGetAttachment(articleId, url),
      };
    }),
  };
});

async function* articleIterator(): AsyncGenerator<
  ZendeskArticle,
  void,
  void
> {
  yield generateLoadedArticle();
}

function generateLoadedArticle(): ZendeskArticle {
  return {
    id: 'article-external-id',
    title: 'article-title',
    body: 'article-body',
    draft: false,
    section_id: CATEGORY_EXTERNAL_ID,
    label_names: ['label-name'],
  };
}

async function* categoryIterator(): AsyncGenerator<
  ZendeskCategory,
  void,
  void
> {
  yield generateLoadedCategory();
}

function generateLoadedCategory(): ZendeskCategory {
  return {
    id: CATEGORY_EXTERNAL_ID,
    name: CATEGORY_NAME,
  };
}

async function* labelIterator(): AsyncGenerator<
  ZendeskLabel,
  void,
  void
> {
  yield generateLoadedLabel();
}

function generateLoadedLabel(): ZendeskLabel {
  return {
    id: 'label-external-id',
    name: 'label-name',
  };
}
