import { describe, expect, it } from '@jest/globals';
import { contentMapper } from './content-mapper';

describe('contentMapper', () => {
  describe('article mapper', () => {
    it('should include article external url if enabled', () => {
      const result = contentMapper([buildArticle()], false, true, {
        servicenowBaseUrl: 'https://test.service-now.com',
      });

      expect(result.documents[0].published?.externalUrl).toBe(
        'https://test.service-now.com/kb_view.do?sysparm_article=KB0012437',
      );
    });
  });

  function buildArticle() {
    return {
      link: 'test-link',
      id: '111',
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
