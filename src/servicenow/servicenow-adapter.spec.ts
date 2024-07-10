import { beforeEach, describe, expect, it } from '@jest/globals';
import { ServiceNowAdapter } from './servicenow-adapter.js';

describe('ServiceNowAdapter', () => {
  let adapter: ServiceNowAdapter;

  beforeEach(async () => {
    adapter = new ServiceNowAdapter();
  });

  it('should extract linked document number from hyperlink', async () => {
    const sysId = '59e1082d1bb242107ef6cb35604bcba9';
    const articleNumber = 'KB0012439';
    const lookupTable = new Map<string, string>([[articleNumber, sysId]]);
    const hyperlink =
      'https://test.service-now.com/kb_view.do?sysparm_article=' +
      articleNumber;
    const result = adapter.extractDocumentIdFromUrl(lookupTable, hyperlink);

    expect(result).toBe(sysId);
  });
});
