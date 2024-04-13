import { InjectionToken } from '@angular/core';
import { SchedulerLike } from 'rxjs';

export const REQUEST_DATA_CONFIG = new InjectionToken<RequestDataConfig>(
  'RequestData Configuration'
);

export const REQUEST_DATA_INITIAL_CONFIG =
  new InjectionToken<RequestDataConfig>('Default RequestData Configuration');

export type RequestDataOptions =
  | Partial<RequestDataConfig>
  | (() => Partial<RequestDataConfig>);

export interface RequestDataConfig {
  readonly scheduler: SchedulerLike;
  readonly dedupeWindowTime: number;
  readonly batchWindowTime: number;
}
