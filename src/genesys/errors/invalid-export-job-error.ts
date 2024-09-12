import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBase } from '../../utils/errors/error-base.js';

export class InvalidExportJobError extends ErrorBase {
  constructor(message: string, details: { [key: string]: any }) {
    super(ErrorCodes.INTERNAL_SERVER_ERROR, details, message);
  }
}
