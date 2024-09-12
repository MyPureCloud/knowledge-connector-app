export abstract class ErrorBase extends Error {
  protected code: string;
  protected details: { [key: string]: any };

  public constructor(
    code: string,
    message: string,
    details?: { [key: string]: any },
  ) {
    super(message);

    this.code = code;
    this.details = typeof details !== 'undefined' ? details : {};
  }

  public getCode(): string {
    return this.code;
  }

  public getDetails(): { [key: string]: any } {
    return this.details;
  }
}
