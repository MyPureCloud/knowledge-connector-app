import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ModificationDateFilter } from './modification-date-filter.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import { SourceAdapter } from '../adapter/source-adapter.js';
import { Category, Document, Label } from '../model';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { DestinationAdapter } from '../adapter/destination-adapter.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel
} from '../tests/utils/entity-generators.js';
import { CompareMode } from '../utils/compare-mode.js';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('ModificationDateFilter', () => {
  const EXTERNAL_VERSION_ID = '2024-04-10 18:33:40';
  const EXTERNAL_VERSION_ID_UPDATED = '2025-01-01 10:10:10';
  const EXTERNAL_ID_PREFIX = 'test-';
  const STORED_DOC_1 = generateNormalizedDocument('-1', 'document-id-1');
  STORED_DOC_1.externalVersionId = EXTERNAL_VERSION_ID;
  const STORED_DOC_2 = generateNormalizedDocument('-2', 'document-id-2');
  const UPDATED_DOC = {
    ...generateNormalizedDocument(
      '-1',
      'document-id-1',
      'updated title',
      null,
      undefined,
      undefined,
      null,
      EXTERNAL_VERSION_ID_UPDATED
    )
  };

  let sourceAdapter: SourceAdapter<Category, Label, Document>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<Adapter, DestinationAdapter>;
  let filter: ModificationDateFilter;
  let context: PipeContext;

  beforeEach(async () => {
    sourceAdapter = {} as typeof sourceAdapter;
    destinationAdapter = new GenesysDestinationAdapter();
    adapters = {
      sourceAdapter,
      destinationAdapter,
    };
    filter = new ModificationDateFilter();
    context = buildContext();

    await filter.initialize(
      { compareMode: CompareMode.MODIFICATION_DATE },
      adapters,
      context,
    );
  });

  describe('runOnCategory', () => {
    it('should return true', async () => {
      const result = await filter.runOnCategory(generateNormalizedCategory('-1'));
      expect(result).toBe(true);
    });
  });

  describe('runOnLabel', () => {
    it('should return true', async () => {
      const result = await filter.runOnLabel(generateNormalizedLabel('-1'));
      expect(result).toBe(true);
    });
  });

  describe('runOnDocument', () => {
    beforeEach(() => {
      prepareStoredContent(
        [],
        [],
        [ STORED_DOC_1, STORED_DOC_2 ],
      );
    })

    describe('when compare mode is set to MODIFICATION_DATE', () => {
      it('should return true when the document has been modified since the last sync', async () => {
        const result = await filter.runOnDocument(UPDATED_DOC);
        expect(result).toBe(true);
        expect(context.syncableContents.documents.deleted.length).toEqual(2);
      });

      it('should return false when the document has been not modified since the last sync', async () => {
        const result = await filter.runOnDocument(STORED_DOC_1);
        expect(result).toBe(false);
      });

      it('should remove document from deleted list when the document has been not modified since the last sync', async () => {
        await filter.runOnDocument(STORED_DOC_1);
        expect(context.syncableContents.documents.deleted.length).toEqual(1);
      });

      it('should handle externalId prefix', async () => {
        await filter.initialize(
          { compareMode: CompareMode.MODIFICATION_DATE, externalIdPrefix: EXTERNAL_ID_PREFIX },
          adapters,
          context,
        );

        prepareStoredContent(
          [],
          [],
          [ {...STORED_DOC_1, externalId: 'test-article-external-id-1'}, STORED_DOC_2 ],
        );

        const result = await filter.runOnDocument({...UPDATED_DOC});

        expect(result).toBe(true);
        expect(context.syncableContents.documents.deleted.length).toEqual(2);
      });
    });

    it('should return true when compare mode is set to CONTENT', async () => {
      await filter.initialize(
        { compareMode: CompareMode.CONTENT },
        adapters,
        context,
      );
      const result = await filter.runOnDocument(UPDATED_DOC);

      expect(result).toBe(true);
      expect(context.syncableContents.documents.deleted.length).toEqual(2);
    });
  });

  function prepareStoredContent(
    categories: Category[],
    labels: Label[],
    documents: Document[],
  ) {
    context.storedContent = {
      categories,
      labels,
      documents,
    };
    context.syncableContents.categories.deleted = [...categories];
    context.syncableContents.labels.deleted = [...labels];
    context.syncableContents.documents.deleted = [...documents];
  }

  function buildContext(): PipeContext {
    return {
      adapter: {
        processedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
        unprocessedItems: {
          categories: [],
          labels: [],
          articles: [],
        },
      },
      pipe: {
        processedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
        unprocessedItems: {
          categories: [],
          labels: [],
          documents: [],
        },
        failedItems: {
          categories: [],
          labels: [],
          documents: [],
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
      categoryLookupTable: {},
      labelLookupTable: {},
      articleLookupTable: {},
    };
  }
});
