import { ImportExportModel } from '../../model/import-export-model.js';
import { Image } from '../../model/image.js';
import { jest } from '@jest/globals';
import { GenesysDestinationConfig } from '../model/genesys-destination-config.js';

export const GenesysDestinationAdapter = jest.fn(() => ({
  initialize: jest
    .fn<(config: GenesysDestinationConfig) => Promise<void>>()
    .mockReturnValue(Promise.resolve()),
  exportAllEntities: jest
    .fn<() => Promise<ImportExportModel>>()
    .mockResolvedValue({
      version: 2,
      knowledgeBase: {
        id: '',
      },
      documents: [],
      categories: [],
      labels: [],
    }),
  lookupImage: jest.fn<() => Promise<string | null>>(),
  getAttachment: jest.fn<() => Promise<Image | null>>(),
  uploadImage: jest.fn<() => Promise<Image | null>>(),
  importData: jest.fn<() => Promise<Image | null>>(),
  deleteArticles: jest.fn<() => Promise<Image | null>>(),
}));
