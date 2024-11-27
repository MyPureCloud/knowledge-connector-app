import { Config } from '../../config.js';

export interface ImageConfig extends Config {
  disableImageUpload?: string;
  relativeImageBaseUrl?: string;
  allowImageFromFilesystem?: string;
  useResourceBaseUrl?: string;
}
