import { Image } from '../model/image.js';
import fs from 'fs/promises';

export class FileReaderClient {
  public static async readImage(url: string): Promise<Image> {
    const fileUrl = new URL(url);
    const filePath = decodeURI(fileUrl.pathname);
    const imageData = await fs.readFile(filePath);
    const content = new Blob([imageData]);

    return {
      url,
      name: url.substring(url.lastIndexOf('/') + 1),
      contentType: '',
      content,
    };
  }
}
