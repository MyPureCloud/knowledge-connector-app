import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';

export class ConfigurerError extends ErrorBasePublic {
  constructor(message: string, details: { [key: string]: unknown }) {
    super(ErrorCodes.CONFIGURER_ERROR, message, details);
  }
}
