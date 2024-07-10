import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenesysDestinationAdapter } from './genesys-destination-adapter.js';
import { Image } from '../model';
import { UploadAssetRequest, UploadAssetResponse } from './model';
import { FileTypeResult } from 'file-type';
import { FileTypeNotSupportedError } from './file-type-not-supported-error';

const mockUploadImageUrl =
  jest.fn<(params: UploadAssetRequest) => Promise<UploadAssetResponse>>();
const mockFileTypeFromBuffer =
  jest.fn<(image: Image) => Promise<FileTypeResult>>();

describe('GenesysDestinationAdapter', () => {
  const HASH = 'the&image&hash';

  let adapter: GenesysDestinationAdapter;

  beforeEach(() => {
    adapter = new GenesysDestinationAdapter();

    adapter.initialize({});
  });

  describe('uploadImage', () => {
    it('should replace invalid characters in the name', async () => {
      mockFileTypeFromBuffer.mockResolvedValueOnce({
        ext: 'png',
      } as FileTypeResult);

      await adapter.uploadImage(HASH, {
        name: `this~name^is|not<valid>because[of]the#/%"characters  \\`,
        content: new Blob(['']),
      } as Image);

      expect(mockUploadImageUrl).toHaveBeenCalledWith({
        name: HASH + '-this-name-is-not-valid-because-of-the----characters---',
      });
    });

    it('should throw when file type not supported', async () => {
      mockFileTypeFromBuffer.mockResolvedValueOnce({
        ext: 'pdf',
      } as FileTypeResult);

      await expect(() =>
        adapter.uploadImage(HASH, {
          name: `this~name^is|not<valid>because[of]the#/%"characters  \\`,
          content: new Blob(['']),
        } as Image),
      ).rejects.toThrow(FileTypeNotSupportedError);
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

jest.mock('file-type', () => {
  return {
    fileTypeFromBuffer: (image: Image) => mockFileTypeFromBuffer(image),
  };
});
