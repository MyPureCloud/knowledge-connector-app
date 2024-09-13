import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';

export class ApiError extends ErrorBasePublic {
  constructor(message: string, details: { [key: string]: unknown }) {
    super(ErrorCodes.THIRD_PARTY_UNEXPECTED_ERROR, message, details);
  }
}
