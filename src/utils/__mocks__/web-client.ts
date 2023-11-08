import { Image } from '../../model/image.js';
import {
  fetch as originalFetch,
  fetchImage as originalFetchImage,
} from '../web-client.js';
import { jest } from '@jest/globals';

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
