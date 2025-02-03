import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { TransformationError } from '../../utils/errors/transformation-error.js';

export class DocumentLinkError extends TransformationError {
  constructor(message: string, details: { [key: string]: unknown }) {
    super(ErrorCodes.DOCUMENT_LINK_ERROR, message, details);
  }
}
