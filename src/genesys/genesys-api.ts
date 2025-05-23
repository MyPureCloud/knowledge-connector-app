import { TokenResponse } from './model/token-response.js';
import { ExportArticlesResponse } from './model/export-articles-response.js';
import { ExportArticlesRequest } from './model/export-articles-request.js';
import { ExportModel } from '../model/sync-export-model.js';
import { Config } from '../config.js';
import { JobStatusResponse } from './model/job-status-response.js';
import { getLogger } from '../utils/logger.js';
import { JobStatus } from './model/job-status.js';
import { RequestInit } from '../utils/web-client.js';
import { EntityType } from '../model/entity-type.js';
import { ExcludeOptions } from '../model/exclude-options.js';

export abstract class GenesysApi {
  protected token?: TokenResponse;

  public abstract initialize(config: Config): Promise<void>;

  protected abstract getLoginUrl(): string;

  protected abstract getBaseUrl(): string;

  protected abstract getClientId(): string;

  protected abstract getClientSecret(): string;

  protected abstract getKnowledgeBaseId(): string;

  protected abstract innerFetch<T>(
    url: string,
    init?: RequestInit,
    entityName?: EntityType,
  ): Promise<T>;

  public createExportJob(exclude?: ExcludeOptions[]): Promise<ExportArticlesResponse> {
    const kbId = this.getKnowledgeBaseId();
    const body: ExportArticlesRequest = {
      exportFilter: {
        versionFilter: 'Latest',
        ...(exclude && exclude.length > 0 ? { exclude } : {})
      },
      fileType: 'json',
      jsonFileVersion: 3,
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

  public fetchExportResult(downloadURL: string): Promise<ExportModel> {
    return this.innerFetch<ExportModel>(downloadURL);
  }

  public fetch<T>(
    endpoint: string,
    init?: RequestInit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: { [key: string]: any },
    entityName?: EntityType,
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
    return this.innerFetch<T>(this.getBaseUrl() + endpoint, config, entityName);
  }

  public async waitForJobToFinish<T extends JobStatusResponse>(
    jobStatusGetter: () => Promise<T>,
    expectedStatuses: JobStatus[],
  ): Promise<T> {
    const job = await jobStatusGetter();
    getLogger().debug('Job ' + JSON.stringify(job));
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
}
