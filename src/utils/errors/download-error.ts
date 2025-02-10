import { ErrorCodes } from './error-codes.js';
import { ErrorBasePublic } from './error-base-public.js';
import { ErrorMessageParams } from './error-message-params.js';
import { EntityType } from '../../model/entity-type.js';

export class DownloadError extends ErrorBasePublic {
  constructor(
    message: string,
    details: ErrorMessageParams,
    entityName?: EntityType,
  ) {
    super(ErrorCodes.DOWNLOAD_FAILURE, message, entityName, details);
  }
}
