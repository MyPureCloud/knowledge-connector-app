export interface HookCallback {
  eventName: HookEvent;
  callback: () => Promise<void>;
}

export enum HookEvent {
  ON_TIMEOUT = 'ON_TIMEOUT',
}
