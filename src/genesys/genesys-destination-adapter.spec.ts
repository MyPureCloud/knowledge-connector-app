import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenesysDestinationAdapter } from './genesys-destination-adapter.js';
import { Image } from '../model';
import { UploadAssetRequest, UploadAssetResponse } from './model';

const mockUploadImageUrl =
  jest.fn<(params: UploadAssetRequest) => Promise<UploadAssetResponse>>();

describe('GenesysDestinationAdapter', () => {
  const HASH = 'the&image&hash';

  let adapter: GenesysDestinationAdapter;

  beforeEach(() => {
    adapter = new GenesysDestinationAdapter();

    adapter.initialize({});
  });

  describe('uploadImage', () => {
    it('should replace invalid characters in the name', () => {
      adapter.uploadImage(HASH, {
        name: `this~name^is|not<valid>because[of]the#/%"characters  \\`,
      } as Image);

      expect(mockUploadImageUrl).toHaveBeenCalledWith({
        name: HASH + '-this-name-is-not-valid-because-of-the----characters---',
      });
    });
  });
});

jest.mock('./genesys-destination-api.js', () => {
  return {
    GenesysDestinationApi: jest.fn().mockImplementation(() => {
      return {
        getUploadImageUrl: (params: UploadAssetRequest) =>
          mockUploadImageUrl(params),
        initialize: jest.fn(),
      };
    }),
  };
});
