import { describe, expect, it } from '@jest/globals';
import {
  DownloadError,
  ErrorBase,
  ErrorBasePublic,
  Interrupted,
} from './errors';
import { catcher } from './catch-error-helper.js';

describe('catchError', () => {
  it('should call the handler if error type matches', async () => {
    let actual = undefined;

    try {
      throw new Interrupted();
    } catch (error) {
      await catcher()
        .on(DownloadError, (_error) => {
          actual = 'DownloadError';
        })
        .on(Interrupted, (_error) => {
          actual = 'Interrupted';
        })
        .with(error);
    }

    expect(actual).toBe('Interrupted');
  });

  it('should await async handler', async () => {
    let actual = undefined;

    try {
      throw new Interrupted();
    } catch (error) {
      await catcher()
        .on(Interrupted, async (_error) => {
          await new Promise<void>((resolve) =>
            setTimeout(() => {
              resolve();
              actual = 'Interrupted';
            }, 100),
          );
        })
        .with(error);
    }

    expect(actual).toBe('Interrupted');
  });

  it('should call the handler if base error type matches', async () => {
    let actual = undefined;

    try {
      throw new DownloadError('message', {});
    } catch (error) {
      await catcher()
        .on(ErrorBase, (_error) => {
          actual = 'ErrorBase';
        })
        .on(Interrupted, (_error) => {
          actual = 'Interrupted';
        })
        .with(error);
    }

    expect(actual).toBe('ErrorBase');
  });

  it('should not call the handler if error type does not match', async () => {
    let actual = undefined;

    await expect(async () => {
      try {
        throw new Interrupted();
      } catch (error) {
        await catcher()
          .on(ErrorBasePublic, (_error) => {
            actual = 'ErrorBasePublic';
          })
          .on(DownloadError, (_error) => {
            actual = 'DownloadError';
          })
          .with(error);
      }
    }).rejects.toThrow(Interrupted);

    expect(actual).toBeUndefined();
  });

  describe('rethrow', () => {
    it('should rethrow when no error type matches', async () => {
      let actual = undefined;

      await expect(async () => {
        try {
          throw new Interrupted();
        } catch (error) {
          await catcher()
            .on(ErrorBasePublic, (_error) => {
              actual = 'ErrorBasePublic';
            })
            .on(DownloadError, (_error) => {
              actual = 'DownloadError';
            })
            .rethrow(Interrupted)
            .with(error);
        }
      }).rejects.toThrow(Interrupted);

      expect(actual).toBeUndefined();
    });

    it('should rethrow when base class matches', async () => {
      let actual = undefined;

      await expect(async () => {
        try {
          throw new DownloadError('', {});
        } catch (error) {
          await catcher()
            .on(Interrupted, (_error) => {
              actual = 'Interrupted';
            })
            .rethrow(ErrorBasePublic)
            .with(error);
        }
      }).rejects.toThrow(DownloadError);

      expect(actual).toBeUndefined();
    });
  });
});
