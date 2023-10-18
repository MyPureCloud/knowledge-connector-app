import { Image } from '../../model/image.js';
import { Response } from 'node-fetch';

export const fetch = jest.fn<Promise<Response>, any[], any>();

export const fetchImage = jest
  .fn<Promise<Image>, any[], any>()
  .mockResolvedValue({
    url: '',
    content: new Blob([''], {
      type: 'image/png',
    }),
    name: 'example-image.png',
    contentType: 'image/png',
  } as Image);
