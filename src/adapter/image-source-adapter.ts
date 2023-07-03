import { Image } from '../model/image.js';
import { Adapter } from './adapter.js';

/**
 * Adapter for fetching attachments from source system
 */
export interface ImageSourceAdapter extends Adapter {
  getAttachment(articleId: string | null, url: string): Promise<Image | null>;
}
