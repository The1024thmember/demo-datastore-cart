import type { SchedulerLike } from 'rxjs';
import { asyncScheduler, Observable, Subscription } from 'rxjs';
import { executeSchedule } from './executeSchedular';

/**
 * Returns an Rx.Observable that emits all items emitted by the source$ Rx.Observable
 * that are distinct by comparison from previous items in a sliding time window.
 *
 * If a comparator function is provided, then it will be called for each item
 * to test for whether or not that value should be emitted.
 *
 * If a comparator function is not provided, an equality check is used by default.
 */
export function distinctInWindow<T>(
  windowTimeSpan: number,
  compare: (x: T, y: T) => boolean = (x: T, y: T) => x === y,
  scheduler?: SchedulerLike
): (source$: Observable<T>) => Observable<T> {
  // default to Rx.asyncScheduler since operator deals explicitly with time
  const internalScheduler = scheduler || asyncScheduler;

  return (source$: Observable<T>) =>
    new Observable<T>((observer) => {
      const buffer: T[] = [];
      const subscriptions = new Subscription();
      subscriptions.add(
        source$.subscribe({
          next(x: T) {
            if (!buffer.some((v) => compare(x, v))) {
              buffer.push(x);
              executeSchedule(
                subscriptions,
                internalScheduler,
                () => {
                  if (buffer.length > 0) {
                    buffer.shift();
                  }
                },
                windowTimeSpan
              );
              observer.next(x);
            }
          },
          error(err: any) {
            buffer.length = 0;
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        })
      );
      return subscriptions;
    });
}
