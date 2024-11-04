import { Image } from '../../model/image.js';
import {
  fetch as originalFetch,
  fetchImage as originalFetchImage,
  readResponse as originalReadResponse,
} from '../web-client.js';
import { jest } from '@jest/globals';
import { Response } from 'undici';

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

export const readResponse = jest.fn<typeof originalReadResponse>(
  (url: string, response: Response) => actualModule.readResponse(url, response),
);
