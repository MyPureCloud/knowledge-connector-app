import { Image } from '../model/image.js';
import {
  default as innerFetch,
  HeadersInit,
  RequestInit,
  Response,
} from 'node-fetch';

export { Response, RequestInit, HeadersInit } from 'node-fetch';

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
    return Promise.reject(new Error(`Image ${url} cannot be downloaded`));
  }

  const content = await response.blob();
  const contentType = response.headers.get('content-type') || '';

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
