import { TransformationError } from './transformation-error.js';
import { ErrorCodes } from './error-codes.js';

export class MissingReferenceError extends TransformationError {
  constructor(
    entityType: 'Category' | 'Label' | 'Document',
    entityId: string | null,
  ) {
    super(ErrorCodes.MISSING_REFERENCE_ERROR, 'Referred entity not found', {
      entityType,
      ...(entityId ? { entityId } : {}),
    });
  }
}
