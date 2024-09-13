export abstract class ErrorBase extends Error {
  protected code: string;
  protected details: { [key: string]: unknown };

  public constructor(
    code: string,
    message: string,
    details?: { [key: string]: unknown },
  ) {
    super(message);

    this.code = code;
    this.details = typeof details !== 'undefined' ? details : {};
  }

  public getCode(): string {
    return this.code;
  }

  public getDetails(): { [key: string]: unknown } {
    return this.details;
  }
}
