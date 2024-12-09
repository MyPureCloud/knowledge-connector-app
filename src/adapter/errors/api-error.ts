import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';
import { EntityType } from '../../model/entity-type';

export class ApiError extends ErrorBasePublic {
  constructor(
    message: string,
    messageParams: { [key: string]: unknown },
    entityName?: EntityType,
  ) {
    super(
      ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR,
      message,
      entityName,
      messageParams,
    );
  }
}
