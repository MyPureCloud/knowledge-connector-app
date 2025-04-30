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
import { runtime } from './runtime.js';
import { getPackageVersion } from './package-version.js';
import { EntityType } from '../model/entity-type.js';
import { retry } from './retry.js';
import { ContentType } from './content-type.js';

export { Response, RequestInit, HeadersInit } from 'undici';

const packageVersion = getPackageVersion();
const nodeVersion = process.version;

/**
 * Fetch an image from the URL
 * @param url
 * @param headers
 * @throws DownloadError
 * @throws Interrupted
 */
export async function fetchImage(
  url: string,
  headers?: HeadersInit,
): Promise<Image> {
  runtime.check();

  if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  headers = new Headers(headers);
  if (!headers.has('User-Agent')) {
    const userAgent = process.env.SOURCE_USER_AGENT
      ? process.env.SOURCE_USER_AGENT
      : `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`;
    headers.set('User-Agent', userAgent);
  }

  const response = await innerFetch(url, { headers });
  if (!response.ok) {
    throw new DownloadError(
      `Image ${url} cannot be downloaded`,
      { url, statusCode: response.status },
      EntityType.DOCUMENT,
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

/**
 * Execute request
 * @param url
 * @param init
 * @param entityName
 * @throws Interrupted
 * @throws ApiError
 */
export async function fetch(
  url: string,
  init?: RequestInit,
  entityName?: EntityType,
): Promise<Response> {
  runtime.check();

  const headers = new Headers(init?.headers);
  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      `knowledge-connector-app/${packageVersion} (node.js ${nodeVersion})`,
    );
  }

  const updatedInit = {
    ...init,
    headers,
  };

  try {
    return await innerFetch(url, updatedInit);
  } catch (error) {
    throw new ApiError(
      `Api request [${url}] failed with error - ${error}`,
      {
        url,
        message: String(error),
      },
      entityName,
      error,
    );
  }
}

/**
 * Read and parse JSON response
 * @param url
 * @param response
 * @param entityName
 * @throws ApiError
 */
export async function readResponse<T>(
  url: string,
  response: Response,
  entityName?: EntityType,
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
      entityName,
      error,
    );
  }
}

/**
 * Verify that the response is ok
 * @param url
 * @param response
 * @param entityName
 * @throws ApiError
 */
export async function verifyResponseStatus(
  url: string,
  response: Response,
  entityName?: EntityType,
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
      entityName,
    );
  }
}

/**
 * Read the text response
 * @param url
 * @param response
 * @param entityName
 * @throws ApiError
 */
export async function readBody(
  url: string,
  response: Response,
  entityName?: EntityType,
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
      entityName,
      error,
    );
  }
}

/**
 * Fetch source resource from URL with content type
 * @param url
 * @param init
 * @param entityName
 * @param acceptContentType
 * @throws ApiError
 * @throws Interrupted
 */
export async function fetchSourceResource<T>(
  url: string,
  init?: RequestInit,
  entityName?: EntityType,
  acceptContentType: ContentType = ContentType.JSON,
): Promise<T> {
  init = setUserAgent(init, process.env.SOURCE_USER_AGENT);
  return await fetchResource<T>(url, init, entityName, acceptContentType);
}

/**
 * Fetch destination resource from URL with content type
 * @param url
 * @param init
 * @param entityName
 * @param acceptContentType
 * @throws ApiError
 * @throws Interrupted
 */
export async function fetchDestinationResource<T>(
  url: string,
  init?: RequestInit,
  entityName?: EntityType,
  acceptContentType: ContentType = ContentType.JSON,
): Promise<T> {
  init = setUserAgent(init, process.env.DESTINATION_USER_AGENT);
  return await fetchResource<T>(url, init, entityName, acceptContentType);
}

export async function readJson<T>(
  url: string,
  response: Response,
  entityName?: EntityType,
): Promise<T> {
  return readResponse<T>(url, response, entityName);
}

export async function readText<T>(
  url: string,
  response: Response,
  entityName?: EntityType,
): Promise<T> {
  await verifyResponseStatus(url, response, entityName);
  return (await readBody(url, response, entityName)) as T;
}

export async function readBlob<T>(
  url: string,
  response: Response,
  entityName?: EntityType,
): Promise<T> {
  await verifyResponseStatus(url, response, entityName);

  try {
    return (await response.blob()) as T;
  } catch (error) {
    const { status } = response;
    throw new ApiError(
      `Api request [${url}] failed to read body from response with status [${status}] - ${error}`,
      {
        url,
        status,
        message: String(error),
      },
      entityName,
      error,
    );
  }
}

async function fetchResource<T>(
  url: string,
  init?: RequestInit,
  entityName?: EntityType,
  acceptContentType: ContentType = ContentType.JSON,
): Promise<T> {
  return retry(async () => {
    const response = await fetch(url, init, entityName);

    if (acceptContentType === ContentType.JSON) {
      return readJson(url, response, entityName);
    } else if (acceptContentType === ContentType.TEXT) {
      return readText(url, response, entityName);
    } else {
      return readBlob(url, response, entityName);
    }
  });
}

function setUserAgent(init: RequestInit = {}, userAgent?: string): RequestInit {
  const headers = new Headers(init?.headers);

  if (userAgent) {
    headers.set('User-Agent', userAgent)
  }

  return {
    ...init,
    headers,
  };
}
