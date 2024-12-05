export interface HookCallback {
  eventName: HookEvent;
  callback: (...params: unknown[]) => Promise<void>;
}

export enum HookEvent {
  ON_TIMEOUT = 'ON_TIMEOUT',
}
