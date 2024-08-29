import { describe, expect, it } from '@jest/globals';
import { contentMapper } from './content-mapper';

describe('contentMapper', () => {
  describe('article mapper', () => {
    it('should include article external url if enabled', () => {
      const result = contentMapper([buildArticle()], false, true, {
        servicenowBaseUrl: 'https://test.service-now.com',
      });

      expect(result.documents[0].externalUrl).toBe(
        'https://test.service-now.com/kb_view.do?sysparm_article=KB0012437',
      );
    });

    it('should set the article 2 times into articleLookupTable', function () {
      const result = contentMapper([buildArticle()], false, true, {
        servicenowBaseUrl: 'https://test.service-now.com',
      });

      expect(result.articleLookupTable?.size).toEqual(2);
      expect(result.articleLookupTable?.get('KB0012437'))
          .toEqual({externalDocumentId: 'kb_knowledge:0d7094289f011200550bf7b6077fcffc'});
      expect(result.articleLookupTable?.get('0d7094289f011200550bf7b6077fcffc'))
          .toEqual({externalDocumentId: 'kb_knowledge:0d7094289f011200550bf7b6077fcffc'});
    });
  });

  function buildArticle() {
    return {
      link: 'test-link',
      id: 'kb_knowledge:0d7094289f011200550bf7b6077fcffc',
      title: 'Test title',
      snippet: 'snippet',
      number: 'KB0012437',
      fields: {
        category: {
          name: 'Test category',
          value: '2222',
          display_value: 'Test category',
        },
        topic: {
          name: 'Test topic',
          value: '3333',
          display_value: 'Test topic',
        },
        text: {
          value: 'Article text',
        },
        workflow_state: {
          value: 'published',
        },
      },
    };
  }
});
