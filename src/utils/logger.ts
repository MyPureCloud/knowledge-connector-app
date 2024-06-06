export interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
}

let current: Logger = console;

export function setLogger(logger: Logger): void {
  current = logger;
}

export function getLogger(): Logger {
  return current;
}
