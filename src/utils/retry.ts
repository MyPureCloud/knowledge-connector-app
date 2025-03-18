import { Circuit, Retry, RetryMode } from 'mollitia';
import { Interrupted } from './errors/interrupted.js';
import { ApiError } from '../adapter/errors/api-error.js';

let circuit: Circuit;
configure();

export function retry<R>(fn: () => Promise<R>): Promise<R> {
  return circuit.fn(fn).execute();
}

export function configure(interval: number = 1000): void {
  circuit = new Circuit({
    options: {
      modules: [
        new Retry({
          attempts: 5,
          interval,
          maxInterval: 120000,
          mode: RetryMode.EXPONENTIAL,
          factor: 3, // 1s, 3s, 27s, 81s, 120s
          onRejection: (err: unknown, _attempt: number): boolean | number => {
            if (err instanceof ApiError) {
              const status = (err as ApiError).getStatus();
              if (status && status >= 400 && status < 500) {
                return false;
              }
            }
            return !(err instanceof Interrupted);
          },
        }),
      ],
    },
  });
}
