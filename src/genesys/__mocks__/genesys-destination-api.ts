import { ImportExportModel } from '../../model/import-export-model.js';

export const GenesysDestinationApi = jest.fn(() => ({
  exportAllEntities: jest
    .fn<Promise<ImportExportModel>, any[], any>()
    .mockResolvedValue({
      version: 2,
      knowledgeBase: {
        id: '',
      },
      documents: [],
      categories: [],
      labels: [],
    }),
  lookupImage: jest.fn<Promise<string | null>, any[], any>(),
}));
