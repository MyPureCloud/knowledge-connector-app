import { Config } from '../../config.js';

export interface ImageConfig extends Config {
  relativeImageBaseUrl?: string;
  allowImageFromFilesystem?: string;
}
