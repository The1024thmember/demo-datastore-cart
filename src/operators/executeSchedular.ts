import type { SchedulerLike, Subscription } from 'rxjs';

/**
 * Executes a schedule of work in a given scheduler with a given delay.
 *
 * @param parentSubscription - The parent subscription that will keep track of the schedule subscription.
 * @param scheduler - The scheduler that will execute the work.
 * @param work - The work to be executed.
 * @param delay - The delay in milliseconds before the work is executed. Default is 0.
 */
export function executeSchedule(
  parentSubscription: Subscription,
  scheduler: SchedulerLike,
  work: () => void,
  delay = 0
): void {
  const scheduleSubscription = scheduler.schedule(() => {
    work();
    scheduleSubscription.unsubscribe();
  }, delay);

  parentSubscription.add(scheduleSubscription);
}
