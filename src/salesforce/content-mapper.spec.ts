import { describe, expect, it } from '@jest/globals';
import { articleMapper } from './content-mapper.js';
import { SalesforceContext } from './model/salesforce-context.js';

describe('contentMapper', () => {
  describe('articleMapper', () => {
    it('should exclude none text fields', () => {
      const [result] = articleMapper(buildArticle(), buildContext(), {
        languageCode: 'en-US',
        buildExternalUrls: false,
        fetchLabels: false,
        contentFields: [],
        baseUrl: '',
      });

      expect(result.published?.title).toBe('the title');
      expect(result.published?.variations[0].rawHtml).toBe(
        '<p>First line</p><p><p>Paragraph</p></p>',
      );
    });

    it('should include only requested fields', () => {
      const [result] = articleMapper(buildArticle(), buildContext(), {
        languageCode: 'en-US',
        buildExternalUrls: false,
        fetchLabels: false,
        contentFields: ['layout item name 5'],
        baseUrl: '',
      });

      expect(result.published?.title).toBe('the title');
      expect(result.published?.variations[0].rawHtml).toBe(
        '<p><p>Paragraph</p></p>',
      );
    });

    it('should include article external url if enabled', () => {
      const [result] = articleMapper(buildArticle(), buildContext(), {
        languageCode: 'en_US',
        buildExternalUrls: true,
        fetchLabels: false,
        contentFields: [],
        baseUrl: 'https://test.lightning.force.com',
      });

      expect(result.externalUrl).toBe(
        'https://test.lightning.force.com/articles/en_US/Knowledge/testUrl',
      );
    });
  });

  function buildArticle() {
    return {
      id: 'text',
      title: 'the title',
      categoryGroups: [],
      urlName: 'testUrl',
      layoutItems: [
        {
          label: 'Title',
          name: 'Title',
          type: 'TEXT',
          value: 'Self link',
        },
        {
          label: 'URL Name',
          name: 'UrlName',
          type: 'TEXT',
          value: 'Self-link',
        },
        {
          label: 'layout item label 1',
          name: 'layout item name 1',
          type: 'TEXT',
          value: 'First line',
        },
        {
          label: 'layout item label 2',
          name: 'layout item name 2',
          type: 'CHECKBOX',
          value: 'true',
        },
        {
          label: 'layout item label 3',
          name: 'layout item name 3',
          type: 'DATE_TIME',
          value: '2024',
        },
        {
          label: 'layout item label 4',
          name: 'layout item name 4',
          type: 'LOOKUP',
          value: '123456',
        },
        {
          label: 'layout item label 5',
          name: 'layout item name 5',
          type: 'RICH_TEXT_AREA',
          value: '<p>Paragraph</p>',
        },
      ],
    };
  }

  function buildContext(): SalesforceContext {
    return {
      adapter: {
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      syncableContents: {
        categories: {
          created: [],
          updated: [],
          deleted: [],
        },
        labels: {
          created: [],
          updated: [],
          deleted: [],
        },
        documents: {
          created: [],
          updated: [],
          deleted: [],
        },
      },
      articleLookupTable: {},
      labelLookupTable: {},
    };
  }
});
