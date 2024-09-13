import { ErrorCodes } from './error-codes.js';
import { ErrorBasePublic } from './error-base-public.js';

export class ValidationError extends ErrorBasePublic {
  constructor(message: string, details: { [key: string]: unknown }) {
    super(ErrorCodes.VALIDATION_ERROR, message, details);
  }
}
