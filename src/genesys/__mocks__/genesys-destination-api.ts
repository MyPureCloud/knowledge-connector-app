import { ImportExportModel } from '../../model/import-export-model.js';
import { jest } from '@jest/globals';

export const GenesysDestinationApi = jest.fn(() => ({
  exportAllEntities: jest
    .fn<() => Promise<ImportExportModel>>()
    .mockResolvedValue({
      version: 3,
      importAction: {
        knowledgeBase: {
          id: '',
        },
        documents: [],
        categories: [],
        labels: [],
      },
      deleteAction: {
        documents: [],
        categories: [],
        labels: [],
      },
    }),
  lookupImage: jest.fn<() => Promise<string | null>>(),
}));
