import { SyncModel } from '../../model/sync-export-model.js';
import { Image } from '../../model/image.js';
import { jest } from '@jest/globals';
import { GenesysDestinationConfig } from '../model/genesys-destination-config.js';
import { SyncDataResponse } from '../../model';

export const GenesysDestinationAdapter = jest.fn(() => ({
  initialize: jest
    .fn<(config: GenesysDestinationConfig) => Promise<void>>()
    .mockReturnValue(Promise.resolve()),
  exportAllEntities: jest.fn<() => Promise<SyncModel>>().mockResolvedValue({
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
  getAttachment: jest.fn<() => Promise<Image | null>>(),
  uploadImage: jest.fn<() => Promise<Image | null>>(),
  importData: jest.fn<() => Promise<Image | null>>(),
  deleteArticles: jest.fn<() => Promise<Image | null>>(),
  syncData: jest
    .fn<(data: SyncModel) => Promise<SyncDataResponse>>()
    .mockResolvedValue({
      id: 'sync-id',
      status: 'Completed',
    }),
}));
