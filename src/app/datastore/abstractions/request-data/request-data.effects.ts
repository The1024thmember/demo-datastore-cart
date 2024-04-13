import { Inject, Injectable } from '@angular/core';
import { Actions, createEffect } from '@ngrx/effects';
import {
  Observable,
  Subscription,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  mergeAll,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { executeSchedule } from 'src/operators/executeSchedular';
import { isDefined, isObject } from 'src/util';

import {
  CollectionActions,
  RequestDataPayload,
  TypedAction,
  isRequestDataAction,
} from '../action';
import { BackendService } from '../backend';
import { dedupeRequests } from '../dedupeRequest';
import {
  RequestErrorWithoutRetry,
  RequestStatusHandler,
} from '../requestStatusHandler';
import {
  ApiFetchResponse,
  DatastoreCollectionType,
  DatastoreFetchCollectionType,
  ResponseData,
  SuccessResponseData,
} from '../store.model';
import { REQUEST_DATA_CONFIG, RequestDataConfig } from './request-data.config';

interface RequestAndResponse<C extends DatastoreCollectionType, E> {
  readonly request: RequestDataPayload<C>;
  readonly res: ResponseData<any, E>;
}

@Injectable()
export class RequestDataEffect {
  readonly requestData$: Observable<TypedAction>;
  private readonly ORIGINAL_REQUESTS_WINDOW = 10_000;
  constructor(
    private backendService: BackendService,
    private actions$: Actions<TypedAction>,
    private requestStatusHandler: RequestStatusHandler,
    @Inject(REQUEST_DATA_CONFIG) private config: RequestDataConfig
  ) {
    const { scheduler, dedupeWindowTime, batchWindowTime } = this.config;

    let originalRequestsMap: {
      readonly [requestId: string]: RequestDataPayload<any>;
    } = {};
    // Optimisation: dedupe requests with limit smaller than the largest in window
    const allRequests$ = this.actions$.pipe(
      filter(isRequestDataAction),
      map((action) => action.payload)
    );

    const requestErrors$ = this.requestStatusHandler.statusStream$.pipe(
      filter(({ statusObject }) => statusObject.error !== undefined)
    );

    const subscriptions = new Subscription();
    const allDedupedRequests$ = allRequests$
      .pipe(
        dedupeRequests(
          dedupeWindowTime,
          requestErrors$.pipe(map((e) => e.request)),
          scheduler
        )
      )
      .pipe(
        tap((request) => {
          originalRequestsMap = {
            ...originalRequestsMap,
            [request.requestIds[0]]: request,
          };

          // remove request after window elapses
          executeSchedule(
            subscriptions,
            scheduler,
            () => {
              const {
                [request.requestIds[0]]: _deleted,
                ...cleanedOriginalRequestsMap
              } = originalRequestsMap;
              originalRequestsMap = cleanedOriginalRequestsMap;
            },
            this.ORIGINAL_REQUESTS_WINDOW
          );
        }),
        distinctUntilChanged(),
        finalize(() => {
          subscriptions.unsubscribe();
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    const response$: Observable<
      readonly RequestAndResponse<DatastoreCollectionType, any>[]
    > = allDedupedRequests$.pipe(
      mergeMap((request) => {
        return this.backendService.fetch(request.ref).pipe(
          map((response) => {
            if (request.requestIds.length > 1) {
              const unbatchedRequests = request.requestIds
                .map((id) => originalRequestsMap[id])
                .filter(isDefined);
              return { res: response, unbatchedRequests };
            }
            return { res: response, unbatchedRequests: [request] };
          }),
          map(({ res, unbatchedRequests }) =>
            this.checkEmptyResponse(res, request, unbatchedRequests)
          ),
          switchMap(({ res, otherRequests, requestsWithMissingItems }) => {
            if (requestsWithMissingItems.length > 0) {
              return throwError(() => ({
                res,
                otherRequests,
                requestsWithMissingItems,
              }));
            }

            // No missing items - dispatch a success action with the original,
            // possibly batched request
            return of([{ request, res }]);
          }),
          // After all retries fail, produce an error status for the unbatched
          // requests that were missing items
          catchError((err) => {
            const { res, otherRequests, requestsWithMissingItems } = err;

            // Only handle the error thrown by missing item logic above
            if (res && otherRequests && requestsWithMissingItems) {
              console.warn(
                `Object(s) not found in response from document call to '${request.collection}'. Response was`,
                res
              );

              return of([
                ...((otherRequests || []) as RequestDataPayload<any>[]).map(
                  (req) => ({
                    request: req,
                    res,
                  })
                ),
                ...(
                  (requestsWithMissingItems || []) as RequestDataPayload<any>[]
                ).map((req) => ({
                  request: req,
                  res: {
                    status: 'error' as const,
                    errorCode: `NOT_FOUND`,
                  },
                })),
              ]);
            }
            // Rethrow other errors - mainly here to so that the missing module
            // error is correctly thrown from `storeBackend.fetch`.
            throw err;
          })
        );
      })
    );

    this.requestData$ = createEffect(() =>
      response$.pipe(
        tap((requests) => {
          requests.forEach(({ request, res }) =>
            this.updateRequestStatuses(res, request)
          );
        }),
        map((requests) =>
          requests.map(({ request, res }) =>
            this.dispatchResponseAction(res, request)
          )
        ),
        mergeAll()
      )
    );
  }

  /**
   * Inspects the network response to verify all items expected by the request
   * actually exist.
   *
   * FIXME: This is not a comprehensive check for missing items, as it relies on
   * several assumptions about the structure of the result object. These
   * assumptions often don't hold for our inconsistent API. This problem can also
   * be avoided entirely by not batching requests.
   * TODO: Find a generic way to check if a response is missing items.
   */
  private checkEmptyResponse<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(
    response: ApiFetchResponse<C>,
    originalRequest: RequestDataPayload<C>,
    unbatchedRequests: readonly RequestDataPayload<C>[]
  ): {
    res: ApiFetchResponse<C>;
    requestsWithMissingItems: readonly RequestDataPayload<C>[];
    otherRequests: readonly RequestDataPayload<C>[];
  } {
    // If there's an actual network 404, all the data is missing.
    if (response.status === 'error' && response.errorCode === 'NOT_FOUND') {
      return {
        res: response,
        requestsWithMissingItems: unbatchedRequests,
        otherRequests: [] as readonly RequestDataPayload<C>[],
      };
    }

    // If the response succeeded, check the items returned.
    if (response.status === 'success') {
      const { requestsWithMissingItems, otherRequests } =
        this.getRequestsWithMissingItems(response, unbatchedRequests);

      return {
        res: response,
        requestsWithMissingItems,
        otherRequests,
      };
    }

    return {
      res: response,
      requestsWithMissingItems: [] as readonly RequestDataPayload<C>[],
      otherRequests: unbatchedRequests,
    };
  }

  /**
   * Partitions requests into ones that are missing items, and ones that are not.
   */
  private getRequestsWithMissingItems<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(
    response: SuccessResponseData<C['Backend']['Fetch']['ReturnType']>,
    unbatchedRequests: readonly RequestDataPayload<C>[]
  ): {
    readonly requestsWithMissingItems: readonly RequestDataPayload<C>[];
    readonly otherRequests: readonly RequestDataPayload<C>[];
  } {
    const result = response.result as any; // FIXME: T267853 -
    const keys = isObject(result) ? Object.keys(result) : [];

    // Check if result is a single key with an empty Array or Object value
    if (keys.length === 1) {
      const resultItems = result[keys[0]];

      if (
        resultItems &&
        ((Array.isArray(resultItems) && resultItems.length === 0) ||
          (isObject(resultItems) && Object.keys(resultItems).length === 0))
      ) {
        return {
          requestsWithMissingItems: unbatchedRequests,
          otherRequests: [],
        };
      }
    }

    // Assume all other result structures are fine
    return { requestsWithMissingItems: [], otherRequests: unbatchedRequests };
  }

  private updateRequestStatuses(
    response: ApiFetchResponse<any>,
    request: RequestDataPayload<any>
  ): void {
    if (response.status === 'error') {
      this.requestStatusHandler.update(request, {
        ready: false,
        error: response as RequestErrorWithoutRetry<any>,
      });
    }
  }

  private dispatchResponseAction(
    response: ApiFetchResponse<any>,
    request: RequestDataPayload<any>
  ): CollectionActions<any> {
    switch (response.status) {
      case 'success': {
        const action: TypedAction = {
          type: 'API_FETCH_SUCCESS',
          payload: {
            collection: request.ref.path.collection,
            result: response.result,
            ref: request.ref,
            requestIds: request.requestIds,
          },
        };

        return action;
      }
      default: {
        const action: TypedAction = {
          type: 'API_FETCH_ERROR',
          payload: {
            collection: request.ref.path.collection,
            ref: request.ref,
            requestIds: request.requestIds,
          },
        };
        return action;
      }
    }
  }
}
