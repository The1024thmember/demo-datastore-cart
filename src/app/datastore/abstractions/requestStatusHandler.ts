import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject, filter, map, switchMap } from 'rxjs';
import { RequestDataPayload } from './action';
import {
  BackendErrorResponse,
  DatastoreCollectionType,
  DatastoreFetchCollectionType,
  StoreState,
} from './store.model';

interface RequestStatusWrapper {
  readonly request: RequestDataPayload<any>;
  readonly statusObject: RequestStatusWithoutRetry<any>;
}

export interface RequestStatusWithoutRetry<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> {
  readonly ready: boolean;
  readonly error?: C extends DatastoreCollectionType
    ? RequestErrorWithoutRetry<C>
    : never;
}

export interface RequestError<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> extends RequestErrorWithoutRetry<C> {
  retry(): void;
}

export interface RequestStatus<C extends DatastoreCollectionType> {
  readonly ready: boolean;
  readonly error?: C extends DatastoreCollectionType &
    DatastoreFetchCollectionType
    ? RequestError<C>
    : never;
}

export type RequestErrorWithoutRetry<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> = Pick<
  // Technically only datastore.document calls return NOT_FOUND, rather than
  // needing to add this to datastore.collection calls too. This type is
  // separate from BackendErrorResponse because NOT_FOUND is added by the
  // datastore internally, rather than originating from the backend.
  BackendErrorResponse<C['Backend']['Fetch']['ErrorType']>,
  'errorCode' | 'requestId'
>;

@Injectable()
export class RequestStatusHandler {
  constructor(private store$: Store<StoreState>) {}

  get statusStream$(): Observable<RequestStatusWrapper> {
    return this._statusStreamSubject$
      .asObservable()
      .pipe(switchMap((statusStreamMap) => Object.values(statusStreamMap)));
  }

  private _statusStreamSubject$ = new Subject<{
    readonly [k: string]: any;
  }>();

  /**
   * Get an observable for the status of a given request
   *
   * @privateRemarks
   *
   * The original request is spread into the payload member to create a new
   * instance of the object which will not get deduped by the `dedupeRequests`
   * handler which only compared object references to determine whether an
   * object is a duplicate or not.
   */
  get$<C extends DatastoreCollectionType & DatastoreFetchCollectionType>(
    request: RequestDataPayload<C>
  ): Observable<RequestStatus<C>> {
    const requestIds = new Set(request.requestIds);
    return this._statusStreamSubject$.pipe(
      map((statusStreamMap) => statusStreamMap[request.ref.path.collection]),
      filter((statusStream) => {
        // Prefilter the status stream to achieve better performance, and it only deals
        // with status related to the collection.
        if (!statusStream) {
          return false;
        }

        // If the stream's client request IDs match any of the IDs in the passed
        // RequestIds set, and only emitting the items that match.
        const statusStreamRequestIds = new Set(statusStream.request.requestIds);

        for (const statusStreamRequestId of statusStreamRequestIds) {
          if (
            typeof statusStreamRequestId === 'string' &&
            requestIds.has(statusStreamRequestId)
          ) {
            return true;
          }
        }
        return false;
      }),
      map((e) => {
        if (e.statusObject.error) {
          return {
            ...e.statusObject,
            error: {
              ...e.statusObject.error,
              retry: () => {
                const action = {
                  type: 'REQUEST_DATA',
                  payload: { ...e.request },
                };
                this.store$.dispatch(action);
                this.update(e.request, { ready: false });
              },
            },
          } as RequestStatus<C>;
        }
        // FIXME: T267853 - Remove cast

        return e.statusObject as RequestStatus<C>;
      })
    );
  }

  // does this structure mean that one collection only keeps one requests status? what if there are multiple component
  // asking for the same resources, this status will confuses the front-end, unless we group all the request to the same collection
  // into one request?

  // also need to ensure that this update only updates the collection's status, the other collection's status should remain unchanged?
  update<C extends DatastoreCollectionType & DatastoreFetchCollectionType>(
    request: RequestDataPayload<C>,
    status: RequestStatusWithoutRetry<C>
  ): void {
    this._statusStreamSubject$.next({
      [request.ref.path.collection]: {
        request,
        statusObject: status,
      },
    });
  }
}

export function requestStatusesEqual<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
>(a: RequestStatus<C>, b: RequestStatus<C>): boolean {
  return (
    // Plain ready flag, no error
    (a.ready === b.ready && !a.error && !b.error) ||
    // Not ready, error codes equal
    (!a.ready &&
      !b.ready &&
      !!a.error &&
      !!b.error &&
      a.error.errorCode === b.error.errorCode)
  );
}
