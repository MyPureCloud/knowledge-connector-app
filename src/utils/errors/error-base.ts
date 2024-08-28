export abstract class ErrorBase extends Error {
  protected code: string;

  protected constructor(code: string, message: string) {
    super(message);

    this.code = code;
  }

  public getCode(): string {
    return this.code;
  }
}
