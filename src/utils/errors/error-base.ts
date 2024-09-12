export abstract class ErrorBase extends Error {
  protected code: string;
  protected details: { [key: string]: any };

  public constructor(
    code: string,
    details: { [key: string]: any },
    message: string,
  ) {
    super(message);

    this.code = code;
    this.details = details;
  }

  public getCode(): string {
    return this.code;
  }

  public getDetails(): { [key: string]: any } {
    return this.details;
  }
}
