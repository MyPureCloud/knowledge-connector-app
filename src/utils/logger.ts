export interface Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, ...optionalParams: any[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, ...optionalParams: any[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, ...optionalParams: any[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, ...optionalParams: any[]): void;
}

let current: Logger = console;

export function setLogger(logger: Logger): void {
  current = logger;
}

export function getLogger(): Logger {
  return current;
}
