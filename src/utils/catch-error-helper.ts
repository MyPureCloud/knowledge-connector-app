/* eslint-disable */
export interface Catcher<T> {
  on: (type: Function, handler: (error: Error) => Promise<T> | T) => Catcher<T>;
  any: (handler: (error: Error) => Promise<T> | T) => Catcher<T>;
  rethrow: (type: Function) => Catcher<T>;
  with: (error: unknown) => Promise<T>;
}

export function catcher<T>(): Catcher<T> {
  const catchers: {
    type: Function | null;
    handler: (error: Error) => Promise<T>;
  }[] = [];

  const catcher: Catcher<T> = {
    on: (
      type: Function,
      handler: (error: Error) => Promise<T> | T,
    ): Catcher<T> => {
      register(type, handler);
      return catcher;
    },
    any: (handler: (error: Error) => Promise<T> | T): Catcher<T> => {
      register(null, handler);
      return catcher;
    },
    rethrow: (type: Function): Catcher<T> => {
      register(type, async (error: Error): Promise<T> => {
        throw error;
      });
      return catcher;
    },
    with: async (error: unknown) => await withError(error),
  };
  return catcher;

  function register(
    type: Function | null,
    handler: (error: Error) => Promise<T> | T,
  ): void {
    catchers.push({
      type,
      handler: async (error: Error): Promise<T> => handler(error),
    });
  }

  async function withError(error: unknown): Promise<T> {
    for (const { type, handler } of catchers) {
      if (!type || error instanceof type.prototype.constructor) {
        return await handler(error as Error);
      }
    }
    throw error;
  }
}

/* eslint-enable */
