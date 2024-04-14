import type { SchedulerLike } from 'rxjs';
import { asyncScheduler, merge, Observable, Subscription } from 'rxjs';
import { filter, map, mergeAll } from 'rxjs/operators';
import { distinctInWindow } from 'src/operators/distinctInWindow';
import { executeSchedule } from 'src/operators/executeSchedular';
import { RequestDataPayload } from './action';
import { referencesEqual } from './store.helpers';
import { DatastoreCollectionType } from './store.model';

/**
 * Deduplicates requests by comparing them with requests received in the last
 * `windowTime` ms.
 *
 * Requests with ids: (e.g. #objects and #object)
 * If a request asks for a particular object id which has been requested before
 * within the interval, it is removed from the request, and then emitted.
 * If this would result in no object ids remaining, the original request
 * is not emitted. Note that the original request is split such that each
 * output request only contains one id each, all emitted simultaneously.
 * i.e. U1:2:3 => U1,U2,U3
 *
 * Example: With a window size of 3 seconds, a request for user with id 1 (U1),
 * then for ids 2 and 1 (U2:1) two seconds later, then again two seconds later:
 *
 * 0     1     2     3     4     5s
 * U1----------U2:1--------U2:1--|
 *        dedupeRequests(3000)
 * U1----------U2----------U1----|
 *
 * Please visit the `.spec.ts` file for more details + diagrams
 *
 * Requests with queries: (e.g. #list)
 * If a request has the same query as another request within the interval,
 * it is not emitted, including empty query objects.
 *
 * IMPORTANT: Assumes that there is at most one clientRequestId for requests
 * in the input observable. This means deduping must occur BEFORE batching.
 *
 * @param windowTime window interval in milliseconds
 */
export function dedupeRequests<C extends DatastoreCollectionType>(
  windowTime: number,
  erroredRequests$: Observable<RequestDataPayload<C>>,
  scheduler: SchedulerLike = asyncScheduler
): (
  source$: Observable<RequestDataPayload<C>>
) => Observable<RequestDataPayload<C>> {
  if (windowTime === 0) {
    return (source$: Observable<RequestDataPayload<C>>) => source$;
  }

  const compareFn = (
    x: RequestDataPayload<C>,
    y: RequestDataPayload<C>
  ): boolean => referencesEqual(x.ref, y.ref);

  // contains the list of the requests that did error during the current window
  const erroredRequestsBuffer: RequestDataPayload<C>[] = [];

  // find previously identical requests that have errored within the window and
  // add them back to the output stream - we won't want these deduped
  const previouslyErroredRequests$ = (
    source$: Observable<RequestDataPayload<C>>
  ): Observable<RequestDataPayload<C>> =>
    source$.pipe(
      filter((request) => {
        const previousError = erroredRequestsBuffer.findIndex((r) =>
          referencesEqual(r.ref, request.ref)
        );
        if (previousError >= 0) {
          erroredRequestsBuffer.splice(previousError, 1);
          return true;
        }
        return false;
      })
    );

  return (source$: Observable<RequestDataPayload<C>>) =>
    new Observable<RequestDataPayload<C>>((observer) => {
      const subscriptions = new Subscription();

      subscriptions.add(
        erroredRequests$.subscribe((x) => {
          if (!erroredRequestsBuffer.some((v) => compareFn(x, v))) {
            erroredRequestsBuffer.push(x);
            executeSchedule(
              subscriptions,
              scheduler,
              () => {
                const erroredRequestIndex = erroredRequestsBuffer.findIndex(
                  (req) => x.requestIds[0] === req.requestIds[0]
                );
                // only remove the errored request from window if it hasn't been removed
                // already in `previouslyErroredRequests$`
                if (erroredRequestIndex >= 0) {
                  erroredRequestsBuffer.splice(erroredRequestIndex, 1);
                }
              },
              windowTime
            );
          }
        })
      );

      subscriptions.add(
        merge(
          source$.pipe(
            map((req) => splitOnIds(req)), // all requests split into ONE id each
            mergeAll(),
            distinctInWindow(windowTime, compareFn, scheduler)
          ),
          previouslyErroredRequests$(source$)
        ).subscribe({
          next(source) {
            observer.next(source);
          },
          error(err) {
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        })
      );

      return () => {
        subscriptions.unsubscribe();
      };
    });
}

/**
 * Splits a single request with more than one object id into multiple requests
 * each with one id in its path
 */
function splitOnIds<C extends DatastoreCollectionType>(
  request: RequestDataPayload<C>
): readonly RequestDataPayload<C>[] {
  const { path } = request.ref;
  const objectIds = path.ids || [];

  // Don't split requests that don't have `ids` or have a query
  // (Yes requests can have `ids` and other query parameters)
  if (objectIds.length === 0 || request.ref.query !== undefined) {
    return [request];
  }

  return objectIds.reduce((requests: RequestDataPayload<C>[], id) => {
    const splitReq: RequestDataPayload<C> = {
      collection: path.collection,
      ref: {
        path: {
          collection: path.collection,
          authUid: path.authUid,
          ids: [id],
        },
      },
      requestIds: request.requestIds,
      isRefetch: request.isRefetch,
    };
    return [...requests, splitReq];
  }, []);
}
