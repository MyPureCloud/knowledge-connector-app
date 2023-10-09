import { Image } from '../model/image.js';
import fetch from 'node-fetch';

export class WebClient {
  public static async fetchImage(url: string): Promise<Image> {
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    const response = await fetch(url);
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
}
