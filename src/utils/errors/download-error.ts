import { ErrorCodes } from './error-codes.js';
import { ErrorBasePublic } from './error-base-public.js';

export class DownloadError extends ErrorBasePublic {
  constructor(message: string) {
    super(ErrorCodes.DOWNLOAD_FAILURE, message);
  }
}
