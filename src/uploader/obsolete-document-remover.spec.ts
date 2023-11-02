import { ObsoleteDocumentRemover } from './obsolete-document-remover.js';
import { Adapter } from '../adapter/adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { GenesysDestinationAdapter } from '../genesys/genesys-destination-adapter.js';
import {
  generateDocument,
  generateImportableContents,
} from '../tests/utils/entity-generators.js';
import { BulkDeleteResponse } from '../model/bulk-delete-response.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../genesys/genesys-destination-adapter.js');

describe('ObsoleteDocumentRemover', () => {
  let obsoleteDocumentRemover: ObsoleteDocumentRemover;
  let sourceAdapter: Adapter;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<Adapter, GenesysDestinationAdapter>;
  let mockDeleteArticles: jest.Mock<() => Promise<BulkDeleteResponse[]>>;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
    };
    destinationAdapter = new GenesysDestinationAdapter();

    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    mockDeleteArticles =
      destinationAdapter.deleteArticles as typeof mockDeleteArticles;
    mockDeleteArticles.mockResolvedValue([
      {
        errorCount: 0,
        errorIndexes: [],
        results: [],
      },
    ]);

    obsoleteDocumentRemover = new ObsoleteDocumentRemover();

    await obsoleteDocumentRemover.initialize({}, adapters);
  });

  describe('when no prefix configured', () => {
    it('should remove all articles', async () => {
      const documentsToDelete = [generateDocument('1'), generateDocument('3')];

      await obsoleteDocumentRemover.run(
        generateImportableContents({
          documents: {
            created: [],
            updated: [],
            deleted: [...documentsToDelete],
          },
        }),
      );

      expect(mockDeleteArticles).toHaveBeenCalledWith(documentsToDelete);
    });
  });

  describe('when prefix configured', () => {
    it('should remove only articles with external ID matching the prefix', async () => {
      await obsoleteDocumentRemover.initialize(
        {
          externalIdPrefix: 'documents-1',
        },
        adapters,
      );

      const documentsToDelete = [generateDocument('1'), generateDocument('3')];

      await obsoleteDocumentRemover.run(
        generateImportableContents({
          documents: {
            created: [],
            updated: [],
            deleted: [...documentsToDelete],
          },
        }),
      );

      expect(mockDeleteArticles).toHaveBeenCalledWith([documentsToDelete[0]]);
    });
  });
});
