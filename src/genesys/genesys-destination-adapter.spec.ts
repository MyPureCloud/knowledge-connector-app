import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenesysDestinationAdapter } from './genesys-destination-adapter.js';
import {
  DocumentUploadResponse,
  ExportModel,
  Image,
  SyncDataResponse,
  SyncModel,
} from '../model';
import {
  ExportArticlesResponse,
  JobStatus,
  JobStatusResponse,
  UploadAssetRequest,
  UploadAssetResponse,
} from './model';
import { FileTypeResult } from 'file-type';
import { FileTypeNotSupportedError } from './errors/file-type-not-supported-error.js';
import { InvalidExportJobError } from './errors/invalid-export-job-error.js';

const mockUploadImageUrl =
  jest.fn<(params: UploadAssetRequest) => Promise<UploadAssetResponse>>();
const mockUploadSyncData =
  jest.fn<(fileName: string, data: Blob) => Promise<DocumentUploadResponse>>();
const mockCreateSyncJob =
  jest.fn<(uploadKey: string) => Promise<SyncDataResponse>>();
const mockGetSyncStatus = jest.fn<(id: string) => Promise<SyncDataResponse>>();
const mockCreateExportJob = jest.fn<() => Promise<ExportArticlesResponse>>();
const mockFetchExportResult =
  jest.fn<(downloadUrl: string) => Promise<ExportModel>>();
const mockWaitForJobToFinish =
  jest.fn<
    (
      jobStatusGetter: () => Promise<SyncDataResponse>,
      expectedStatuses: JobStatus[],
    ) => Promise<JobStatusResponse>
  >();
const mockFileTypeFromBuffer =
  jest.fn<(image: Image) => Promise<FileTypeResult>>();

describe('GenesysDestinationAdapter', () => {
  const HASH = 'the&image&hash';
  const UPLOAD_KEY = 'some-upload-key';
  const JOB_ID = 'some-job-id';
  const DOWNLOAD_URL = 'http://some-download-url.not.exists';

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

  describe('syncData', () => {
    const data: SyncModel = {
      version: 3,
      importAction: {
        knowledgeBase: {
          id: 'kb-id',
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
    };

    beforeEach(() => {
      mockUploadSyncData.mockResolvedValue({ uploadKey: UPLOAD_KEY });
      mockGetSyncStatus.mockResolvedValue({
        id: JOB_ID,
        status: 'Completed',
      });
    });

    it('should upload and create sync operation', async () => {
      await adapter.syncData(data);

      expect(mockUploadSyncData).toHaveBeenCalledWith(
        expect.stringContaining('sync-'),
        expect.any(Blob),
      );
      expect(mockCreateSyncJob).toHaveBeenCalledWith(UPLOAD_KEY);
      expect(mockWaitForJobToFinish).toHaveBeenCalled();
    });
  });

  describe('exportAllEntities', () => {
    beforeEach(() => {
      mockCreateExportJob.mockResolvedValue({
        id: JOB_ID,
        status: 'Completed',
        downloadURL: DOWNLOAD_URL,
      });
      mockWaitForJobToFinish.mockResolvedValue({
        id: JOB_ID,
        status: 'Completed',
        downloadURL: DOWNLOAD_URL,
      } as JobStatusResponse);
      mockFetchExportResult.mockResolvedValue({
        version: 3,
        importAction: {},
      } as ExportModel);
    });

    it('should fetch the result of the export job', async () => {
      const expected = { version: 3, importAction: {} } as ExportModel;

      const actual = await adapter.exportAllEntities();

      expect(mockCreateExportJob).toHaveBeenCalledWith();
      expect(mockWaitForJobToFinish).toHaveBeenCalled();
      expect(mockFetchExportResult).toHaveBeenCalledWith(DOWNLOAD_URL);
      expect(actual).toEqual(expected);
    });

    it('should throw when response contains no downloadUrl', async () => {
      mockWaitForJobToFinish.mockResolvedValue({
        id: JOB_ID,
        status: 'Completed',
      });

      await expect(() => adapter.exportAllEntities()).rejects.toThrow(
        InvalidExportJobError,
      );
    });
  });
});

jest.mock('./genesys-destination-api.js', () => {
  return {
    GenesysDestinationApi: jest.fn().mockImplementation(() => {
      return {
        getUploadImageUrl: (params: UploadAssetRequest) =>
          mockUploadImageUrl(params),
        uploadSyncData: (fileName: string, data: Blob) =>
          mockUploadSyncData(fileName, data),
        createSyncJob: (uploadKey: string) => mockCreateSyncJob(uploadKey),
        getSyncStatus: (id: string) => mockGetSyncStatus(id),
        waitForJobToFinish: (
          jobStatusGetter: () => Promise<SyncDataResponse>,
          expectedStatuses: JobStatus[],
        ) => mockWaitForJobToFinish(jobStatusGetter, expectedStatuses),
        createExportJob: () => mockCreateExportJob(),
        fetchExportResult: (downloadURL: string) =>
          mockFetchExportResult(downloadURL),
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
