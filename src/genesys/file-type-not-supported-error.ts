export class FileTypeNotSupportedError extends Error {
  constructor(fileType: string, supportedList: string[]) {
    super(
      `The file type ${fileType} is not supported (only ${supportedList.join(', ')})`,
    );
  }
}
