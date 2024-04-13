import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  Observable,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  from,
  isObservable,
  map,
  shareReplay,
  switchMap,
  take,
} from 'rxjs';
import { AuthService } from 'src/services/authService/authService';
import { AuthState } from 'src/services/authService/authService.interface';
import { isDefined, isEqual, toObservable } from 'src/util';
import { RequestDataAction } from './action';
import { BackendService } from './backend';
import { Documents } from './datastore-documents';
import { Query } from './query';
import {
  RequestStatus,
  RequestStatusHandler,
  requestStatusesEqual,
} from './requestStatusHandler';
import { select } from './select';
import {
  QueryResultWithMetadata,
  flattenQuery,
  generateRequestId,
  getDocuments,
} from './store.helpers';
import {
  BackendPushResponse,
  DatastoreCollectionType,
  DatastorePushCollectionType,
  LOGGED_OUT_KEY,
  Path,
  PushDocumentType,
  Reference,
  StoreState,
} from './store.model';
import { WebSocketService } from './websocket/websocket';
@Injectable()
export class Datastore {
  constructor(
    private store$: Store<StoreState>,
    private backendService: BackendService,
    private requestStatusHandler: RequestStatusHandler,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {}

  documents<C extends DatastoreCollectionType>(
    collectionName: C['Name'],
    queryFnOrIds$?:
      | ((q: Query<C>) => Query<C> | Observable<Query<C>>)
      | Observable<readonly number[]>
      | Observable<readonly string[]>
  ): Documents<C> {
    // flatten the query from query function
    const flattenedQuery$ = flattenQuery<C>(
      isObservable(queryFnOrIds$)
        ? (query) => query.where('id', 'in', queryFnOrIds$)
        : queryFnOrIds$
    );
    // construct ref$ object, which is used in `Action` and Documents object
    const ref$: Observable<Reference<C>> = combineLatest([
      toObservable(collectionName),
      this.authService.getAuthUid(),
      flattenedQuery$,
    ]).pipe(
      map(([collectionName, authUid, { limit, queryParams }]) => ({
        path: {
          collection: collectionName,
          authUid: String(authUid),
        },
        query: {
          limit,
          queryParams,
          isDocumentQuery: false,
        },
      })),
      distinctUntilChanged(isEqual)
    );

    // construct request object, which generates id of the request and dispatch the request data action
    const request$ = ref$.pipe(
      map((ref) => {
        const requestId = generateRequestId();
        const action: RequestDataAction<C> = {
          type: 'REQUEST_DATA',
          payload: {
            collection: collectionName,
            ref,
            requestIds: [],
          },
        };

        this.store$.dispatch(action);

        return {
          collection: collectionName,
          ref,
          requestIds: [requestId],
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }) // to ensure multiple subscribe won't run the logic again
    );

    // fetching the data from datastore based on the request
    const data$ = request$.pipe(
      switchMap((request) => {
        // mark the current request as not ready
        this.requestStatusHandler.update(request, { ready: false });
        const {
          collection,
          ref: { path },
        } = request;
        return this.store$.pipe(
          select(collection, path.authUid),
          filter(isDefined),
          map((storeSlice) => getDocuments(storeSlice, request.ref)),
          distinctUntilChanged(),
          filter(isDefined),
          map((documents) => {
            this.requestStatusHandler.update(request, { ready: true });
            return documents;
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }) // to ensure multiple subscribe won't run the logic again
    );

    // get the request status
    const requestStatus$ = request$.pipe(
      switchMap((request) => {
        return request
          ? this.requestStatusHandler.get$(request)
          : from([{ ready: false }, { ready: true }]); // emits two values, first emits {ready:false}, then {ready:true}
      }),
      distinctUntilChanged(requestStatusesEqual),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // creates documents object
    return new Documents(
      ref$,
      data$ as Observable<QueryResultWithMetadata<C>>, // --TO-DO-- remove type casting
      requestStatus$ as Observable<RequestStatus<C>>, // --TO-DO-- remove type casting
      this.backendService
    );
  }

  // Create a single document
  createDocument<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    collectionName: C['Name'],
    document: PushDocumentType<C> & {
      readonly id?: number | string;
    },
    extra?: { readonly [index: string]: string | number }
  ): Promise<BackendPushResponse<C>> {
    /**Posting */
    return firstValueFrom(
      combineLatest([
        toObservable(collectionName),
        this.authService.authState$,
      ]).pipe(
        map(([collection, authState]: [C['Name'], AuthState | undefined]) => {
          const path: Path<C> = {
            collection,
            authUid: authState ? authState.userId : LOGGED_OUT_KEY,
          };

          return { path };
        }),
        take(1),
        switchMap((ref) => this.backendService.push(ref, document, extra))
      )
    );
  }
}

export type DatastoreInterface = Interface<Datastore>;

/**
 * Strip out non-public fields from a class.
 *
 * Useful when you want to say one class implements the same methods as another.
 * From https://github.com/microsoft/TypeScript/issues/471#issuecomment-381842426
 */
export type Interface<T> = {
  [P in keyof T]: T[P];
};
