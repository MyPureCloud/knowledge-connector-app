import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';
import { EntityType } from '../../model/entity-type.js';

export class AttachmentDomainNotAllowedError extends ErrorBasePublic {
  constructor(url: string, entityId?: string | null) {
    super(
      ErrorCodes.ATTACHMENT_DOMAIN_NOT_ALLOWED,
      'Skipped downloading attachment, domain not allowed: ' + url,
      EntityType.DOCUMENT,
      { url, ...(entityId ? { entityId } : {}) },
    );
  }
}
