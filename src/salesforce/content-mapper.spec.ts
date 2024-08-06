import { describe, expect, it } from '@jest/globals';
import { contentMapper } from './content-mapper.js';

describe('contentMapper', () => {
  describe('article mapper', () => {
    it('should exclude none text fields', () => {
      const result = contentMapper(
        [],
        [buildArticle()],
        { salesforceLanguageCode: 'en-US' },
        false,
        false,
      );

      expect(result.documents[0].published?.title).toBe('the title');
      expect(result.documents[0].published?.variations[0].rawHtml).toBe(
        '<p>First line</p><p><p>Paragraph</p></p>',
      );
    });

    it('should include only requested fields', () => {
      const result = contentMapper(
        [],
        [buildArticle()],
        {
          salesforceArticleContentFields: 'layout item name 5',
          salesforceLanguageCode: 'en-US',
        },
        false,
        false,
      );

      expect(result.documents[0].published?.title).toBe('the title');
      expect(result.documents[0].published?.variations[0].rawHtml).toBe(
        '<p><p>Paragraph</p></p>',
      );
    });

    it('should include article external url if enabled', () => {
      const result = contentMapper(
        [],
        [buildArticle()],
        {
          salesforceLightningBaseUrl: 'https://test.lightning.force.com',
          salesforceLanguageCode: 'en-us',
        },
        false,
        true,
      );

      expect(result.documents[0].externalUrl).toBe(
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
});
