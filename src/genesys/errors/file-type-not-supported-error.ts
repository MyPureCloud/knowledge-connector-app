import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { ErrorBasePublic } from '../../utils/errors/error-base-public.js';
import { EntityType } from '../../model/entity-type';

export class FileTypeNotSupportedError extends ErrorBasePublic {
  constructor(fileType: string, supportedList: string[]) {
    super(
      ErrorCodes.FILE_TYPE_NOT_SUPPORTED,
      `The file type ${fileType} is not supported (only ${supportedList.join(', ')})`,
      EntityType.DOCUMENT,
      {
        messageParams: {
          fileType,
          supportedFileType: supportedList,
        },
      },
    );
  }
}
