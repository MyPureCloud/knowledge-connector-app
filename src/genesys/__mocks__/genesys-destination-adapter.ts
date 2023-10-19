import { ImportExportModel } from '../../model/import-export-model.js';
import { Image } from '../../model/image.js';

export const GenesysDestinationAdapter = jest.fn(() => ({
  initialize: jest
    .fn<Promise<void>, any[], any>()
    .mockReturnValue(Promise.resolve()),
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
  getAttachment: jest.fn<Promise<Image | null>, any[], any>(),
  uploadImage: jest.fn<Promise<Image | null>, any[], any>(),
  importData: jest.fn<Promise<Image | null>, any[], any>(),
  deleteArticles: jest.fn<Promise<Image | null>, any[], any>(),
}));
