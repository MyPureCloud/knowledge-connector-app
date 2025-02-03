import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { runtime } from './runtime.js';
import { Interrupted } from './errors';
import { HookEvent } from '../pipe/hook-callback.js';

describe('runtime', () => {
  describe('check', () => {
    beforeEach(() => {
      runtime.reset();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throw interrupted after given seconds', async () => {
      runtime.setProcessKillTimer(2);

      jest.advanceTimersByTime(2000);
      jest.runAllTicks();
      jest.runAllTimers();

      expect(() => runtime.check()).toThrow(Interrupted);
    });

    describe('when stopProcessKillTimer called', () => {
      it('should not throw interrupted after given seconds', async () => {
        runtime.setProcessKillTimer(2);
        runtime.stopProcessKillTimer();

        jest.advanceTimersByTime(3000);
        jest.runAllTicks();
        jest.runAllTimers();

        expect(() => runtime.check()).not.toThrow();
      });
    });
  });

  describe('triggerEvent', () => {
    it('should call registered listeners', async () => {
      let actual = '';

      runtime.hooks(
        HookEvent.ON_TIMEOUT,
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              actual = 'called';
              resolve();
            }, 1000),
          ),
      );

      await runtime.triggerEvent(HookEvent.ON_TIMEOUT);

      expect(actual).toBe('called');
    });
  });
});
