import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';
import { ErrorMessageParams } from '../../utils/errors/error-message-params.js';
import { ApiError } from './api-error.js';

export class InvalidCredentialsError extends ErrorBasePublic {
  constructor(message: string, messageParams?: ErrorMessageParams) {
    super(
      ErrorCodes.THIRD_PARTY_INVALID_CREDENTIALS,
      message,
      undefined,
      messageParams,
    );
  }

  public static fromApiError(
    message: string,
    apiError: ApiError,
  ): InvalidCredentialsError {
    const { messageParams } = apiError.toFailedEntityErrors()[0];

    return new InvalidCredentialsError(message, messageParams);
  }
}
