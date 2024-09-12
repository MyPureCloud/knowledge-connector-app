import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';

export class AttachmentDomainNotAllowedError extends ErrorBasePublic {
  constructor(url: string) {
    super(
      ErrorCodes.ATTACHMENT_DOMAIN_NOT_ALLOWED,
      { url },
      'Skipped downloading attachment, domain not allowed: ' + url,
    );
  }
}
