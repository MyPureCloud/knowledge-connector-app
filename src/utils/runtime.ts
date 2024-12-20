import { Interrupted } from './errors/interrupted.js';
import { HookEvent } from '../pipe/hook-callback.js';
import { getLogger } from './logger.js';
import { HookCallback } from '../pipe/hook-callback.js';

class RuntimeService {
  private interrupted: boolean = false;
  private hookMap: Map<HookEvent, HookCallback[]> = new Map();
  private processKillTimer: NodeJS.Timeout | null = null;

  /**
   * Register hook callbacks
   * @param {HookEvent} eventName
   * @param {Function} callback
   */
  public hooks(eventName: HookEvent, callback: () => Promise<void>): void {
    let callbacks = this.hookMap.get(eventName);
    if (!callbacks) {
      callbacks = [];
      this.hookMap.set(eventName, callbacks);
    }

    callbacks.push({
      eventName,
      callback,
    });
  }

  public interrupt(): void {
    this.interrupted = true;
  }

  public check(): void {
    if (this.interrupted) {
      throw new Interrupted();
    }
  }

  public reset() {
    this.interrupted = false;
  }

  public setProcessKillTimer(lifetimeInSeconds: number): void {
    this.processKillTimer = setTimeout(
      () => this.onTimeout(lifetimeInSeconds),
      lifetimeInSeconds * 1000,
    );
  }

  public stopProcessKillTimer(): void {
    if (this.processKillTimer) {
      clearTimeout(this.processKillTimer);
    }
  }

  public async triggerEvent(event: HookEvent): Promise<void> {
    const hookCallbacks = this.hookMap.get(event);
    if (hookCallbacks?.length) {
      for (const hook of hookCallbacks) {
        try {
          await hook.callback();
        } catch (error) {
          getLogger().error(`Error running ${event} callback - ${error}`);
        }
      }
    }
  }

  private async onTimeout(lifetimeInSeconds: number): Promise<void> {
    getLogger().info(
      `Connector app did not finish in [${lifetimeInSeconds}] seconds. Stopping...`,
    );
    this.interrupt();
  }
}

export const runtime = new RuntimeService();
