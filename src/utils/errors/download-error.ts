import { ErrorCodes } from './error-codes.js';
import { ErrorBasePublic } from './error-base-public.js';

export class DownloadError extends ErrorBasePublic {
  constructor(message: string, details: { [key: string]: unknown }) {
    super(ErrorCodes.DOWNLOAD_FAILURE, message, details);
  }
}
