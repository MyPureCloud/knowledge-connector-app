import { Image } from '../model/image.js';
import {
  fetch as innerFetch,
  HeadersInit,
  RequestInit,
  Response,
} from 'undici';
import { DownloadError } from './errors/download-error.js';

export { Response, RequestInit, HeadersInit } from 'undici';

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
  return await innerFetch(url, init);
}
