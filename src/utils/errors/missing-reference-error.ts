import { TransformationError } from './transformation-error.js';
import { ErrorCodes } from './error-codes.js';
import { EntityType } from '../../model/entity-type.js';

export class MissingReferenceError extends TransformationError {
  constructor(entityType: EntityType, entityId: string | null) {
    super(
      ErrorCodes.MISSING_REFERENCE_ERROR,
      'Referred entity not found',
      entityType,
      entityId ? { entityId } : {},
    );
  }
}
