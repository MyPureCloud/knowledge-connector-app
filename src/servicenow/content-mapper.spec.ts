import { beforeEach, describe, expect, it } from '@jest/globals';
import { articleMapper } from './content-mapper.js';
import { ServiceNowContext } from './model/servicenow-context.js';

describe('contentMapper', () => {
  let context: ServiceNowContext;

  beforeEach(() => {
    context = {} as ServiceNowContext;
  });

  describe('article mapper', () => {
    it('should include article external url if enabled', () => {
      const [result] = articleMapper(
        buildArticle(),
        {
          fetchCategories: false,
          buildExternalUrls: true,
          baseUrl: 'https://test.service-now.com',
        },
        context,
      );

      expect(result.externalUrl).toBe(
        'https://test.service-now.com/kb_view.do?sysparm_article=KB0012437',
      );
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
        sys_updated_on: {
          display_value: '04/10/2024 13:33:40',
          name: 'sys_updated_on',
          label: 'Updated',
          type: 'glide_date_time',
          value: '2024-04-10 18:33:40'
        },
      },
    };
  }
});
