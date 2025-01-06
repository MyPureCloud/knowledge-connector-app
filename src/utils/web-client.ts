import { Image } from '../model/image.js';
import {
  fetch as innerFetch,
  Headers,
  HeadersInit,
  RequestInit,
  Response,
} from 'undici';
import { DownloadError } from './errors/download-error.js';
import { ApiError } from '../adapter/errors/api-error.js';
import { readFileSync } from 'node:fs';

export { Response, RequestInit, HeadersInit } from 'undici';

const packageVersion = process.env.npm_package_version ||
    JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)).toString()).version || 'no version';
const nodeVersion = process.version;

export async function fetchImage(
  url: string,
  headers?: HeadersInit,
): Promise<Image> {
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  const requestHeaders = headers ? { headers } : {};
  const response = await innerFetch(url, requestHeaders);
  if (!response.ok) {
    return Promise.reject(
      new DownloadError(`Image ${url} cannot be downloaded`, { url }),
    );
  }

  const content = await response.blob();
  const contentType = response.headers.get('content-type') ?? '';

  return {
    url,
    name: url.substring(url.lastIndexOf('/') + 1),
    contentType,
    content,
  };
}

export async function fetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('User-Agent', `knowledge-connector-app: ${packageVersion}, @Node-version: ${nodeVersion}`);

  const updatedInit = {
    ...init,
    headers,
  };
  return await innerFetch(url, updatedInit);
}

export async function readResponse<T>(
  url: string,
  response: Response,
): Promise<T> {
  await verifyResponseStatus(url, response);

  const body = await readBody(url, response);

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new ApiError(
      `Api request [${url}] failed to parse body [${body}] - ${error}`,
      {
        url,
        status: response.status,
        message: String(error),
        body,
      },
    );
  }
}

export async function verifyResponseStatus(
  url: string,
  response: Response,
): Promise<void> {
  const { status, ok } = response;

  if (!ok) {
    const body = await readBody(url, response);

    throw new ApiError(
      `Api request [${url}] failed with status [${status}] and message [${body}]`,
      {
        url,
        status,
        message: `API request failed with status: ${status}`,
        body,
      },
    );
  }
}

export async function readBody(
  url: string,
  response: Response,
): Promise<string> {
  const { status } = response;

  try {
    return await response.text();
  } catch (error) {
    throw new ApiError(
      `Api request [${url}] failed to read body from response with status [${status}] - ${error}`,
      {
        url,
        status,
        message: String(error),
      },
    );
  }
}
