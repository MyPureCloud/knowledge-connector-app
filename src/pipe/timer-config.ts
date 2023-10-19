import { Config } from '../config.js';

export interface TimerConfig extends Config {
  killAfterLongRunningSeconds?: string;
}
