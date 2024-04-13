import { Injectable, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  asapScheduler,
  combineLatest,
  delay,
  distinctUntilChanged,
  firstValueFrom,
  isObservable,
  map,
  NEVER,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AuthState } from 'src/services/authService/authService.interface';
import { AuthTestingService } from 'src/services/authService/test/authTestingService';
import { arrayIsShallowEqual, isEqual, toObservable } from 'src/util';
import { DatastoreInterface } from '../abstractions/datastore';
import { Documents } from '../abstractions/datastore-documents';
import { Query } from '../abstractions/query';
import { RequestStatus } from '../abstractions/requestStatusHandler';
import { select } from '../abstractions/select';
import {
  flattenQuery,
  generateRequestId,
  stringifyReference,
} from '../abstractions/store.helpers';
import {
  BackendPushResponse,
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  LOGGED_OUT_KEY,
  Path,
  PushDocumentType,
  Reference,
} from '../abstractions/store.model';
import { FakeBackendService, SimulatedFetchRequestFailure } from './backend';
import {
  DatastoreTestingInterface,
  debugConsoleLog,
  getFakeDocuments,
  IdOrIdsOrQuery,
} from './datastore.testing.interface';
import { NonObservableQuery } from './fake-query';
import {
  DeleteRequestErrorCode,
  FakeUserCollectionStateSlice,
  FetchRequestErrorCode,
  MutationPropagator,
  PushRequestErrorCode,
  PushTransformer,
  SetRequestErrorCode,
  UpdateRequestErrorCode,
  UpdateTransformer,
} from './store.model';

@UntilDestroy()
@Injectable()
export class DatastoreFake
  implements DatastoreInterface, DatastoreTestingInterface, OnDestroy
{
  constructor(
    private fakeBackendService: FakeBackendService,
    private authTestingService: AuthTestingService
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
      this.authTestingService.getAuthUid(),
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

        return {
          collection: collectionName,
          ref,
          requestIds: [requestId],
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }) // to ensure multiple subscribe won't run the logic again
    );

    /**
     * Unlike the "real" datastore this isn't filtered for `undefined`
     * so that you can use this to define the status stream.
     */

    const data$ = request$.pipe(
      switchMap((request) => {
        const {
          collection,
          ref: { path },
        } = request;

        const errorState = this.getCollectionErrorState(request.ref);
        if (errorState) {
          debugConsoleLog(
            `datastore.collection: Making request to ${collection} fail/pending`,
            stringifyReference(request.ref),
            errorState
          );

          return NEVER;
        }

        return this.fakeBackendService.storeState$.pipe(
          // store$ emits on every action dispatched and store state change
          select(collection, path.authUid),
          switchMap((storeSlice) => {
            // delay the fetch if the collection is configured to do so
            const delayTime =
              this.fakeBackendService.collectionsToDelay.get(
                `${collectionName}-fetch`
              ) ?? 0;

            return delayTime > 0
              ? of(storeSlice).pipe(delay(delayTime, asapScheduler))
              : of(storeSlice);
          }),
          map((storeSlice) => storeSlice as FakeUserCollectionStateSlice<C>),
          map((storeSlice) => getFakeDocuments(storeSlice, request.ref)),
          distinctUntilChanged(arrayIsShallowEqual),
          map((documentsWithMetadata) => ({
            documentsWithMetadata,
            request,
          }))
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    const requestStatus$ = combineLatest([
      request$,
      data$.pipe(startWith(undefined)),
    ]).pipe(
      map(
        ([request, source]) =>
          /* While the real datastore will emit `false` then `true`,
           * doing this immediately can break Angular's change detection,
           * so let's derive this from the request and source streams
           * and only emit once.
           */
          this.getCollectionErrorState(request.ref) ?? {
            ready: source !== undefined,
          }
      ),
      //  distinctUntilChanged(requestStatusesEqual),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    return new Documents(
      ref$,
      data$.pipe(
        map(({ documentsWithMetadata, request }) => ({
          documentsWithMetadata: documentsWithMetadata
            // Apply the limit here not selectDocumentsForQuery so we can do approximateTotalCount
            .slice(0, request.ref.query?.limit)
            .map((rawDocument) => ({
              rawDocument,
            })),
          request,
        })),

        distinctUntilChanged()
      ),
      requestStatus$,
      this.fakeBackendService
    );
  }

  /**
   * A request should fail if:
   *  - the collection should fail when it is empty
   *
   * The `retry` method is set to clear the error on being called.
   */
  private getCollectionErrorStateWhenEmpty<C extends DatastoreCollectionType>(
    ref: Reference<C>,
    source: C['DocumentType'] | undefined
  ): RequestStatus<C> | undefined {
    const collectionFailureWhenEmpty =
      this.fakeBackendService.collectionsToFailWhenEmpty.get(
        ref.path.collection
      );
    const failure = collectionFailureWhenEmpty;

    if (failure?.status === 'error' && !source) {
      return {
        ready: false,
        error: {
          errorCode: failure.errorCode,
          retry: () => {
            if (collectionFailureWhenEmpty) {
              this.fakeBackendService.collectionsToFailWhenEmpty.delete(
                ref.path.collection
              );
            }
          },
        } as RequestStatus<C>['error'],
      };
    }
    if (failure?.status === 'pending') {
      return { ready: false };
    }
    return undefined;
  }

  /**
   * A request should fail if either:
   *  - the whole collection should fail, OR
   *  - if that specify request should fail
   *
   * The `retry` method is set to clear the error on being called.
   */
  private getCollectionErrorState<C extends DatastoreCollectionType>(
    ref: Reference<C>
  ): RequestStatus<C> | undefined {
    const collectionFailure =
      this.fakeBackendService.fetchCollectionsToFail.get(ref.path.collection);
    const requestFailure = this.fakeBackendService.requestsToFail.get(
      this.generateRefKey(ref)
    );
    const failure = collectionFailure ?? requestFailure;

    if (failure?.status === 'error') {
      return {
        ready: false,
        error: {
          errorCode: failure.errorCode,
          retry: () => {
            if (collectionFailure) {
              this.fakeBackendService.fetchCollectionsToFail.delete(
                ref.path.collection
              );
            } else {
              this.fakeBackendService.requestsToFail.delete(
                this.generateRefKey(ref)
              );
            }
          },
        } as RequestStatus<C>['error'],
      };
    }

    if (failure?.status === 'pending') {
      return { ready: false };
    }
    return undefined;
  }

  createDocument<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    collectionName: C['Name'],
    document: PushDocumentType<C> & {
      readonly id?: number | string;
    },
    extra?: { readonly [index: string]: string | number }
  ): Promise<BackendPushResponse<C>> {
    return firstValueFrom(
      combineLatest([
        toObservable(collectionName),
        this.authTestingService.authState$,
      ]).pipe(
        map(([collection, authState]: [C['Name'], AuthState | undefined]) => {
          const path: Path<C> = {
            collection,
            authUid: authState ? authState.userId : LOGGED_OUT_KEY,
          };
          return { path };
        }),

        switchMap((ref) =>
          this.fakeBackendService.push<C>(ref, document, extra)
        ),
        untilDestroyed(this)
      )
    );
  }

  /**
   * Creates an object directly in the store.
   */
  createRawDocument<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    collectionName: C['Name'],
    document: C['DocumentType']
  ): Promise<BackendPushResponse<any>> {
    return firstValueFrom(
      combineLatest([
        toObservable(collectionName),
        this.authTestingService.authState$,
      ]).pipe(
        map(([collection, authState]: [C['Name'], AuthState | undefined]) => {
          const path: Path<C> = {
            collection,
            authUid: authState ? authState.userId : LOGGED_OUT_KEY,
          };
          return { path };
        }),

        switchMap((ref) => this.fakeBackendService.pushRaw<C>(ref, document)),
        untilDestroyed(this)
      )
    );
  }

  /**
   * Clears the state, push transformers and resets errors.
   */
  resetState<C extends DatastoreCollectionType>(
    collectionName?: C['Name']
  ): Promise<void> {
    return firstValueFrom(
      this.authTestingService.authState$.pipe(
        tap((authState) => {
          this.fakeBackendService.reset(
            authState ? authState.userId : LOGGED_OUT_KEY,
            collectionName
          );
        }),
        untilDestroyed(this)
      )
    ).then((_) => undefined);
  }

  /**
   * Since the real datastore supports fields that are computed in the backend
   * the fake needs explicit functions to do this computation to be registered.
   */
  addPushTransformer<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(collectionName: C['Name'], transformer: PushTransformer<C>): void {
    this.fakeBackendService.pushTransformers.set(
      collectionName,
      transformer as unknown as PushTransformer<
        DatastoreCollectionType & DatastorePushCollectionType
      >
    );
  }

  /**
   * Since the real datastore's reducers can use the backend response to merge
   * documents for updates, the fake needs functions to replicate this.
   */
  addUpdateTransformer<
    C extends DatastoreCollectionType & DatastoreUpdateCollectionType
  >(collectionName: C['Name'], transformer: UpdateTransformer<C>): void {
    this.fakeBackendService.updateTransformers.set(
      collectionName,
      transformer as unknown as UpdateTransformer<
        DatastoreCollectionType & DatastoreUpdateCollectionType
      >
    );
  }

  addMutationPropagator<
    C1 extends DatastoreCollectionType & DatastorePushCollectionType,
    C2 extends DatastoreCollectionType & DatastorePushCollectionType
  >(propagator: MutationPropagator<C1, C2>): void {
    if (propagator.to === propagator.from) {
      throw new Error(
        'Mutation propagators between the same collection are not allowed. Use a push/update transformer instead.'
      );
    }

    if (
      this.fakeBackendService.mutationPropagators.find(
        (p) => propagator.from === p.from && propagator.to === p.to
      )
    ) {
      throw new Error(
        `Mutation propagator from '${propagator.from}' to '${propagator.to}' already exists, add any logic to that instead.`
      );
    }

    this.fakeBackendService.mutationPropagators = [
      ...this.fakeBackendService.mutationPropagators,
      propagator,
    ];
  }

  /**
   * Makes a fetch datastore call to a particular collection error in the specified way
   */
  private makeFetchCollectionError<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(collectionName: C['Name'], error: SimulatedFetchRequestFailure<C>): void {
    this.fakeBackendService.fetchCollectionsToFail.set(collectionName, error);
  }

  /**
   * Clear fetch request fails set by makeCollectionFailFetch.
   */
  clearCollectionFailFetch(): void {
    this.fakeBackendService.fetchCollectionsToFail.clear();
  }

  /**
   * Make all push requests to a particular datastore collection fail.
   */
  makeCollectionFailFetch<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(collectionName: C['Name'], errorCode: FetchRequestErrorCode<C>): void {
    return this.makeFetchCollectionError(collectionName, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Make all push requests to a particular datastore collection fail.
   */
  makeCollectionFailPush<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(collectionName: C['Name'], errorCode: PushRequestErrorCode<C>): void {
    this.fakeBackendService.pushCollectionsToFail.set(collectionName, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Clear push request fails set by makeCollectionFailPush.
   */
  clearCollectionFailPush(): void {
    this.fakeBackendService.pushCollectionsToFail.clear();
  }

  /**
   * Make all push requests to a particular datastore collection fail.
   */
  makeCollectionFailSet<
    C extends DatastoreCollectionType & DatastoreSetCollectionType
  >(collectionName: C['Name'], errorCode: SetRequestErrorCode<C>): void {
    this.fakeBackendService.setCollectionsToFail.set(collectionName, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Clear set request fails set by makeCollectionFailSet.
   */
  clearCollectionFailSet(): void {
    this.fakeBackendService.setCollectionsToFail.clear();
  }

  makeCollectionFailUpdate<
    C extends DatastoreCollectionType & DatastoreUpdateCollectionType
  >(collectionName: C['Name'], errorCode: UpdateRequestErrorCode<C>): void {
    this.fakeBackendService.updateCollectionsToFail.set(collectionName, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Clear update request fails set by markCollectionFailUpdate.
   */
  clearCollectionFailUpdate(): void {
    this.fakeBackendService.updateCollectionsToFail.clear();
  }

  /**
   * Make all delete requests to a particular datastore collection fail.
   */
  makeCollectionFailDelete<
    C extends DatastoreCollectionType & DatastoreDeleteCollectionType
  >(collectionName: C['Name'], errorCode: DeleteRequestErrorCode<C>): void {
    this.fakeBackendService.deleteCollectionsToFail.set(collectionName, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Clear delete request fails set by makeCollectionFailDelete.
   */
  clearCollectionFailDelete(): void {
    this.fakeBackendService.deleteCollectionsToFail.clear();
  }

  /**
   * Make requests to the given collection delayed by the given amount of milliseconds.
   */
  makeCollectionDelayed<C extends DatastoreCollectionType>(
    collectionName: C['Name'],
    delayMilliseconds: number,
    requestType: 'fetch' | 'push' | 'set' | 'update' | 'delete'
  ): void {
    this.fakeBackendService.collectionsToDelay.set(
      `${collectionName}-${requestType}`,
      delayMilliseconds
    );
  }

  /**
   * Clear request delays set by makeCollectionDelayed.
   */
  clearCollectionDelayed(): void {
    this.fakeBackendService.collectionsToDelay.clear();
  }

  /**
   * Make a specific fetch request to the datastore fail.
   */
  makeRequestFail<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(
    collectionName: C['Name'],
    idOrIdsOrQuery: IdOrIdsOrQuery<C>,
    errorCode: FetchRequestErrorCode<C>
  ): void {
    return this.makeRequestError(collectionName, idOrIdsOrQuery, {
      status: 'error',
      errorCode,
    });
  }

  /**
   * Clear fetch request fails set by makeRequestFail.
   */
  clearRequestFail(): void {
    this.fakeBackendService.requestsToFail.clear();
  }

  private makeRequestError<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(
    collectionName: C['Name'],
    idOrIdsOrQuery: IdOrIdsOrQuery<C>,
    error: SimulatedFetchRequestFailure<C>
  ): void {
    if (Array.isArray(idOrIdsOrQuery)) {
      this.fakeBackendService.requestsToFail.set(
        this.generateRefKey({
          path: {
            collection: collectionName,
            authUid: '', // Let's keep things simple and not make this user dependent
            ids: idOrIdsOrQuery.map((id) => id.toString()),
          },
        }),
        error
      );
    } else if (
      typeof idOrIdsOrQuery === 'number' ||
      typeof idOrIdsOrQuery === 'string'
    ) {
      this.fakeBackendService.requestsToFail.set(
        this.generateRefKey({
          path: {
            collection: collectionName,
            authUid: '', // Let's keep things simple and not make this user dependent
            ids: [idOrIdsOrQuery.toString()],
          },
        }),
        error
      );
    } else if (typeof idOrIdsOrQuery === 'function') {
      const { queryParams = {}, limitValue: limit } = idOrIdsOrQuery(
        NonObservableQuery.newQuery()
      );
      this.fakeBackendService.requestsToFail.set(
        this.generateRefKey({
          path: { collection: collectionName, authUid: '' },
          query: {
            queryParams,
            isDocumentQuery: false, // This is ignored
            limit,
          },
        }),
        error
      );
    }
  }

  private generateRefKey<C extends DatastoreCollectionType>(
    ref: Reference<C>
  ): string {
    return `${ref.path.collection};${stringifyReference(ref)}`;
  }

  ngOnDestroy(): void {}
}
