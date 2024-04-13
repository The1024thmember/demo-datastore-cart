import 'reflect-metadata';
import type { SubscriptionLike } from 'rxjs';

/**
 * This is a property decorator. It overrides the getter and setter of the decorated property to enforce
 * its current subscription is unsubscribed before it being assigned to a new Subscription.
 */
export function RepetitiveSubscription() {
  return (target: Object, propertyKey: string) => {
    function getter(this: any): any {
      return this[`_${propertyKey}`];
    }

    function setter(this: any, newVal: SubscriptionLike | undefined): void {
      if (
        this[`_${propertyKey}`] &&
        typeof this[`_${propertyKey}`].unsubscribe === 'function'
      ) {
        this[`_${propertyKey}`].unsubscribe();
      }
      this[`_${propertyKey}`] = newVal;
    }

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
    });
  };
}
