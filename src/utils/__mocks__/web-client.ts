import { Image } from '../../model/image.js';
import {
  fetch as originalFetch,
  fetchImage as originalFetchImage,
  fetchResource as originalFetchResource,
  readResponse as originalReadResponse,
} from '../web-client.js';
import { jest } from '@jest/globals';
import { RequestInit, Response } from 'undici';
import { EntityType } from '../../model/entity-type.js';
import { ContentType } from '../content-type.js';

const actualModule =
  jest.requireActual<typeof import('../web-client.js')>('../web-client.js');

export const fetch = jest.fn<typeof originalFetch>();

export const fetchImage = jest
  .fn<typeof originalFetchImage>()
  .mockResolvedValue({
    url: '',
    content: new Blob([''], {
      type: 'image/png',
    }),
    name: 'example-image.png',
    contentType: 'image/png',
  } as Image);

export const fetchResource = jest.fn<typeof originalFetchResource>(
  async (
    url: string,
    init?: RequestInit,
    entityName?: EntityType,
    acceptContentType: ContentType = ContentType.JSON,
  ) => fakeFetchResource(url, init, entityName, acceptContentType),
);

export const readResponse = jest.fn<typeof originalReadResponse>(
  (url: string, response: Response) => actualModule.readResponse(url, response),
);

async function fakeFetchResource<T>(
  url: string,
  init?: RequestInit,
  entityName?: EntityType,
  acceptContentType: ContentType = ContentType.JSON,
): Promise<T> {
  const response = await fetch(url, init, entityName);

  if (acceptContentType === ContentType.JSON) {
    return actualModule.readJson(url, response, entityName);
  } else if (acceptContentType === ContentType.TEXT) {
    return actualModule.readText(url, response, entityName);
  } else {
    return actualModule.readBlob(url, response, entityName);
  }
}
