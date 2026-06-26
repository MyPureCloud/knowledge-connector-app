import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';
import { ErrorCodes } from '../../utils';

export class ImageUploadLimitError extends ErrorBasePublic {
  constructor(message: string) {
    super(ErrorCodes.IMAGE_LIMIT_EXCEEDED, message);
  }
}
