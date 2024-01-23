import { TokenResponse } from './model/token-response.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { ExportArticlesRequest } from './model/export-articles-request.js';
import { ExportModelV2 } from '../model/import-export-model.js';
import { Config } from '../config.js';
import { JobStatusResponse } from './model/job-status-response.js';
import logger from '../utils/logger.js';
import { JobStatus } from './model/job-status.js';
import { fetch, RequestInit, Response } from '../utils/web-client.js';

export abstract class GenesysApi {
  protected token?: TokenResponse;

  public abstract initialize(config: Config): Promise<void>;

  protected abstract getLoginUrl(): string;

  protected abstract getBaseUrl(): string;

  protected abstract getClientId(): string;

  protected abstract getClientSecret(): string;

  protected abstract getKnowledgeBaseId(): string;

  public createExportJob(): Promise<ExportArticlesResponse> {
    const kbId = this.getKnowledgeBaseId();
    const body: ExportArticlesRequest = {
      exportFilter: {
        versionFilter: 'Latest',
      },
      fileType: 'json',
    };
    return this.fetch<ExportArticlesResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/export/jobs`,
      {
        method: 'POST',
      },
      body,
    );
  }

  public getExportStatus(exportId: string): Promise<ExportArticlesResponse> {
    const kbId = this.getKnowledgeBaseId();
    return this.fetch<ExportArticlesResponse>(
      `/api/v2/knowledge/knowledgeBases/${kbId}/export/jobs/${exportId}`,
    );
  }

  public fetchExportResult(downloadURL: string): Promise<ExportModelV2> {
    return this.innerFetch<ExportModelV2>(downloadURL);
  }

  public fetch<T>(
    endpoint: string,
    init?: RequestInit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: { [key: string]: any },
  ): Promise<T> {
    const config: RequestInit = {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${this.token?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
    return this.innerFetch<T>(this.getBaseUrl() + endpoint, config);
  }

  public async waitForJobToFinish<T extends JobStatusResponse>(
    jobStatusGetter: () => Promise<T>,
    expectedStatuses: JobStatus[],
  ): Promise<T> {
    const job = await jobStatusGetter();
    logger.debug('Job ' + JSON.stringify(job));
    if (!expectedStatuses.includes(job.status)) {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            this.waitForJobToFinish(jobStatusGetter, expectedStatuses)
              .then(resolve)
              .catch(reject),
          1000,
        );
      });
    }

    return Promise.resolve(job);
  }

  protected async authenticate(): Promise<void> {
    this.token = await this.innerFetch<TokenResponse>(
      this.getLoginUrl() + '/oauth/token',
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              this.getClientId() + ':' + this.getClientSecret(),
              'utf-8',
            ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );
  }

  protected async innerFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    await this.verifyResponse(response, url);

    const json = await response.json();
    return json as T;
  }

  protected async verifyResponse(
    response: Response,
    url: string,
  ): Promise<void> {
    if (!response.ok) {
      const message = JSON.stringify(await response.json());
      throw new Error(
        `Api request [${url}] failed with status [${response.status}] and message [${message}]`,
      );
    }
  }
}
