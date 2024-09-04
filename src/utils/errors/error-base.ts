export abstract class ErrorBase extends Error {
  protected code: string;

  public constructor(code: string, message: string) {
    super(message);

    this.code = code;
  }

  public getCode(): string {
    return this.code;
  }
}
