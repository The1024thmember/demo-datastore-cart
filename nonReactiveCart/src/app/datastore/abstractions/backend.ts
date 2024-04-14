import { HttpParams } from '@angular/common/http';
import {
  Inject,
  Injectable,
  InjectionToken,
  ModuleWithProviders,
  NgModule,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, filter, map, of, switchMap, withLatestFrom } from 'rxjs';
import { HttpsService } from 'src/services/httpsService';
import { RecursivePartial, assertNever, isDefined } from 'src/util';
import {
  CollectionActions,
  DeleteErrorAction,
  DeleteRequestPayload,
  PushErrorAction,
  PushRequestPayload,
  SetErrorAction,
  SetRequestPayload,
  UpdateErrorAction,
  UpdateRequestPayload,
} from './action';
import { StoreBackendInterface } from './backend.interface';
import { filterNotEmptyFields, getOrignialDocument } from './store.helpers';
import {
  ApiFetchResponse,
  BackendDeleteRequest,
  BackendDeleteResponse,
  BackendFetchRequest,
  BackendPushRequest,
  BackendPushResponse,
  BackendSetRequest,
  BackendSetResponse,
  BackendSuccessResponse,
  BackendUpdateRequest,
  BackendUpdateResponse,
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  Delta,
  ExtractIdFunction,
  Path,
  PushDocumentType,
  RawQuery,
  Reference,
  ResponseData,
  SetDocumentType,
  StoreState,
} from './store.model';

type FetchRequestFactory<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> = (
  authUid: string,
  /** The document IDs passed to a `datastore.document` call */
  ids: readonly string[] | undefined,
  /** The query passed to a `datastore.collection` call or `document` call by secondary ID */
  query: RawQuery<C['DocumentType']> | undefined
) => BackendFetchRequest<C>;

type PushRequestFactory<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = (
  authUid: string,
  document: PushDocumentType<C>,
  extra: { readonly [index: string]: string | number } | undefined
) => BackendPushRequest<C>;

type SetRequestFactory<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = (authUid: string, document: SetDocumentType<C>) => BackendSetRequest<C>;

type UpdateRequestFactory<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = (
  authUid: string,
  delta: Delta<C['DocumentType']>,
  originalDocument: C['DocumentType']
) => BackendUpdateRequest<C>;

type DeleteRequestFactory<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> = (
  authUid: string,
  id: string | number,
  originalDocument: C['DocumentType']
) => BackendDeleteRequest<C>;

/**
 * This type is strange as it seeks to enforce that the backend factory
 * implements each method if and only iff it is specified in the collection
 * type. If not you need to specify `undefined`.
 *
 * The `C['Backend']['Fetch'] extends never` is needed to check if it's actually
 * there, and the `C extends DatastoreFetchCollectionType` is necessary to let
 * TypeScript know it is there. Not sure why we need both :(
 */
export interface Backend<C extends DatastoreCollectionType> {
  readonly fetch: C['Backend']['Fetch'] extends never
    ? undefined
    : C extends DatastoreCollectionType & DatastoreFetchCollectionType
    ? FetchRequestFactory<C>
    : undefined;

  readonly push: C['Backend']['Push'] extends never
    ? undefined
    : C extends DatastoreCollectionType & DatastorePushCollectionType
    ? PushRequestFactory<C>
    : undefined;

  readonly set: C['Backend']['Set'] extends never
    ? undefined
    : C extends DatastoreCollectionType & DatastoreSetCollectionType
    ? SetRequestFactory<C>
    : undefined;

  readonly update: C['Backend']['Update'] extends never
    ? undefined
    : C extends DatastoreCollectionType & DatastoreUpdateCollectionType
    ? UpdateRequestFactory<C>
    : undefined;

  readonly remove: C['Backend']['Delete'] extends never
    ? undefined
    : C extends DatastoreCollectionType & DatastoreDeleteCollectionType
    ? DeleteRequestFactory<C>
    : undefined;

  readonly maxBatchSize?: number;

  /** Can you subscribe to these events from the websocket? */
  readonly isSubscribable?: true;
}

export type BackendConfigs = { [K in string]?: Backend<any> }; // FIXME: T267853 -

export type BackendCollectionsProvider = readonly any[]; // FIXME: T267853 -
export type BackendConfigsProvider = readonly Backend<any>[]; // FIXME: T267853 -

export const BACKEND_COLLECTIONS =
  new InjectionToken<BackendCollectionsProvider>('Backend Collections');

export const BACKEND_CONFIGS = new InjectionToken<BackendConfigsProvider>(
  'Backend Configs'
);

@NgModule({})
export class BackendFeatureModule {
  constructor(
    backendService: BackendService,
    @Inject(BACKEND_COLLECTIONS) backendCollections: BackendCollectionsProvider,
    @Inject(BACKEND_CONFIGS) backendConfigs: BackendConfigsProvider
  ) {
    backendCollections.map((collectionName, index) => {
      backendService.addFeature(collectionName, backendConfigs[index]);
    });
  }
}

@Injectable()
export class BackendService implements StoreBackendInterface {
  private backendConfigs: BackendConfigs = {};

  constructor(
    private httpsService: HttpsService,
    private store$: Store<StoreState>
  ) {}

  /**
   * Checks if the backend config (*.backend.ts) for a given collection is available.
   * It is only available if the BackendFeatureModule (or DatastoreFeatureModule)
   * for that collection has been imported.
   *
   * Note that this does not check if the @ngrx/store feature module for that
   * collection has been imported. This is only possible when we have access to
   * store state, i.e. upon subscription to the store. However, since the both
   * the store and backend feature modules are imported together in the various
   * `DatastoreXModule` modules, checking one of these is equivalent to checking
   * the other.
   */
  isFeatureLoaded<C extends DatastoreCollectionType>(collection: any): boolean {
    return collection in this.backendConfigs;
  }

  addFeature<C extends DatastoreCollectionType>(
    collectionName: any,
    requestFactory: BackendConfigs[any]
  ): void {
    this.backendConfigs[collectionName] = requestFactory;
  }

  fetch<C extends DatastoreCollectionType & DatastoreFetchCollectionType>(
    ref: Reference<C>
  ): Observable<ApiFetchResponse<C> | any> {
    // --TO-DO--  need to fix the type casting
    // extract query params from ref
    const { path, query } = ref;
    const { collection, authUid, ids } = path;

    return of(this.backendConfigs[collection]).pipe(
      map((config) => {
        if (!config) {
          throw new DatastoreMissingModuleError(collection);
        }
        return config.fetch;
      }),
      filter(isDefined),

      map((fetch: FetchRequestFactory<C>) => fetch(authUid, ids, query)),
      // either have field {endpoint, params} or {payload, enpoint, params, method, asFormData}
      switchMap((requestData: BackendFetchRequest<C>) => {
        // if it is post method, use post request
        if ('method' in requestData && requestData.method === 'POST') {
          return this.httpsService.post(
            requestData.endpoint,
            requestData.payload,
            { params: requestData.params as unknown as HttpParams } // --TO-DO-- remove type casting
          );
        }
        return this.httpsService.get<ApiFetchResponse<C>>(
          requestData.endpoint,
          {
            params: requestData.params as unknown as HttpParams, // --TO-DO-- remove type casting
          }
        );
      })
    );
  }

  // partial update
  update<C extends DatastoreCollectionType & DatastoreUpdateCollectionType>(
    ref: Reference<C>,
    id: number | string,
    delta: RecursivePartial<C['DocumentType']>
  ): Observable<BackendUpdateResponse<C>> {
    const { path, query } = ref;
    const { collection, authUid } = path;
    return of(this.backendConfigs[collection]).pipe(
      map((config) => {
        if (!config) {
          throw new DatastoreMissingModuleError(collection);
        }
        return config.update;
      }),
      filter(isDefined),
      withLatestFrom(this.store$),
      switchMap(([update, storeState]) => {
        const originalDocument = getOrignialDocument(storeState, path, id);
        if (!originalDocument) {
          throw new Error('Missing original document');
          //--TO-DO-- Provide the logic for fetching the docuemnt by id if the id is not in local store
          // To ensure updates success
        }

        const updateRequest = update(authUid, delta, originalDocument);
        // check update request method: put? or update

        // Send the merged document as payload for action
        const updatedDocument = {
          ...originalDocument,
          ...filterNotEmptyFields(updateRequest.payload),
        };

        if (updateRequest.method && updateRequest.method === 'POST') {
          const result$ = this.httpsService.post(
            updateRequest.endpoint,
            updateRequest.payload,
            { params: updateRequest.params as unknown as HttpParams } // --TO-DO-- remove type casting
          );

          return result$.pipe(
            map((result) => {
              return {
                result: {
                  ...result,
                  result: updatedDocument,
                }, // should be the original document patching the request payload
                payload: {
                  collection,
                  payload: updateRequest.payload,
                  ref,
                  delta,
                  originalDocument,
                },
              };
            })
          );
        }
        return this.httpsService
          .put(updateRequest.endpoint, updateRequest.payload, {
            params: updateRequest.params as unknown as HttpParams, // --TO-DO-- remove type casting
          })
          .pipe(
            map((result) => {
              return {
                result: {
                  ...result,
                  result: updatedDocument,
                }, // should be the original document patching the request payload
                payload: {
                  collection,
                  payload: updateRequest.payload,
                  ref,
                  delta,
                  originalDocument,
                },
              };
            })
          );
      }),
      map(({ result, payload }) => {
        return this.sendActions(
          {
            type: 'UPDATE',
            payload: payload as unknown as UpdateRequestPayload<C>,
          },
          path,
          query,
          result
        );
      })
    );
  }

  delete<C extends DatastoreCollectionType & DatastoreDeleteCollectionType>(
    ref: Reference<C>,
    id: number | string
  ): Observable<BackendDeleteResponse<C>> {
    // executing delete request
    const { path, query } = ref;
    const { collection, authUid } = path;
    return of(this.backendConfigs[collection]).pipe(
      map((config) => {
        if (!config) {
          throw new DatastoreMissingModuleError(collection);
        }
        return config.remove;
      }),
      filter(isDefined),
      map((set: DeleteRequestFactory<C>) => set),
      withLatestFrom(this.store$),
      map(([del, storeState]) => {
        const originalDocument = getOrignialDocument(storeState, path, id);
        if (originalDocument === undefined) {
          throw new Error('Missing original document');
        }
        const deleteRequest = del(path.authUid, id, originalDocument);
        return {
          deleteRequest,
          payload: {
            collection,
            ref,
            rawRequest: deleteRequest.payload,
            originalDocument,
          },
        };
      }),
      switchMap(({ deleteRequest, payload }) => {
        switch (deleteRequest.method) {
          case 'POST':
            return this.httpsService
              .post(
                deleteRequest.endpoint,
                deleteRequest.payload,
                { params: deleteRequest.params as unknown as HttpParams } // --TO-DO-- remove type casting
              )
              .pipe(map((result) => ({ payload, result })));
          case 'PUT':
            return this.httpsService
              .put(
                deleteRequest.endpoint,
                { params: deleteRequest.params as unknown as HttpParams } // --TO-DO-- remove type casting
              )
              .pipe(map((result) => ({ payload, result })));
          case 'DELETE':
            // --TO-DO- add the param back as similar to put and post request
            return this.httpsService
              .delete(deleteRequest.endpoint)
              .pipe(map((result) => ({ payload, result })));
          default:
            return assertNever(deleteRequest.method);
        }
      }),
      map(({ payload, result }) =>
        this.sendActions(
          { type: 'DELETE', payload },
          payload.ref.path,
          payload.ref.query,
          result
        )
      )
    );
  }

  // The post request
  push<C extends DatastoreCollectionType & DatastorePushCollectionType>(
    ref: Reference<C>,
    document: PushDocumentType<C>,
    extra?: { readonly [index: string]: string | number }
  ): Observable<BackendPushResponse<C>> {
    const { path, query } = ref;
    const collection = path.collection;

    return of(this.backendConfigs[collection]).pipe(
      map((config) => {
        if (!config) {
          throw new DatastoreMissingModuleError(collection);
        }
        return config.push;
      }),
      filter(isDefined),
      map((push: PushRequestFactory<C>) => {
        const pushRequest = push(path.authUid, document, extra);

        return {
          pushRequest,
          payload: {
            collection,
            ref,
            document,
            rawRequest: pushRequest.payload,
          },
        };
      }),

      switchMap(({ pushRequest, payload }) => {
        return this.httpsService
          .post(
            pushRequest.endpoint,
            pushRequest.payload,
            { params: pushRequest.params as unknown as HttpParams } // --TO-DO-- remove type casting
          )
          .pipe(
            map((result) => ({
              payload,
              result,
              extractId: pushRequest.extractId,
            }))
          );
      }),
      map(({ payload, result, extractId }) => {
        return this.sendActions(
          { type: 'PUSH', payload },
          path,
          query,
          result,
          extractId
        ) as BackendPushResponse<C>; // --TO-DO--  remove type cast
      })
    );
  }

  // The patch request, create new resources if there is none
  set<C extends DatastoreCollectionType & DatastoreSetCollectionType>(
    ref: Reference<C>,
    id: number | string,
    document: SetDocumentType<C>
  ): Observable<BackendSetResponse<C>> {
    const { path, query } = ref;
    const collection = path.collection;

    return of(this.backendConfigs[collection]).pipe(
      map((config) => {
        if (!config) {
          throw new DatastoreMissingModuleError(collection);
        }
        return config.set;
      }),
      filter(isDefined),
      map((set: SetRequestFactory<C>) => set),
      withLatestFrom(this.store$),
      map(([set, storeState]) => {
        const originalDocument = getOrignialDocument(storeState, path, id);
        const setRequest = set(path.authUid, document);
        return {
          setRequest,
          payload: {
            collection,
            ref,
            document,
            originalDocument,
            rawRequest: setRequest.payload,
          },
        };
      }),

      switchMap(({ setRequest, payload }) =>
        this.httpsService
          .post(
            setRequest.endpoint,
            setRequest.payload,
            { params: setRequest.params as unknown as HttpParams } // --TO-DO-- remove type casting
          )
          .pipe(map((result) => ({ payload, result })))
      ),
      map(({ payload, result }) =>
        this.sendActions({ type: 'SET', payload }, path, query, result)
      )
    );
  }

  private sendActions<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    baseAction: {
      readonly type: 'PUSH';
      readonly payload: PushRequestPayload<C>;
    },
    path: Path<C>,
    query: RawQuery<C['DocumentType']> | undefined,
    data: ResponseData<
      C['Backend']['Push']['ReturnType'],
      C['Backend']['Push']['ErrorType']
    >,
    extractId?: ExtractIdFunction<C>
  ): BackendPushResponse<C>;
  private sendActions<
    C extends DatastoreCollectionType & DatastoreSetCollectionType
  >(
    baseAction: {
      readonly type: 'SET';
      readonly payload: SetRequestPayload<C>;
    },
    path: Path<C>,
    query: RawQuery<C['DocumentType']> | undefined,
    data: ResponseData<
      C['Backend']['Set']['ReturnType'],
      C['Backend']['Set']['ErrorType']
    >
  ): BackendSetResponse<C>;
  private sendActions<
    C extends DatastoreCollectionType & DatastoreUpdateCollectionType
  >(
    baseAction: {
      readonly type: 'UPDATE';
      readonly payload: UpdateRequestPayload<C>;
    },
    path: Path<C>,
    query: RawQuery<C['DocumentType']> | undefined,
    data: ResponseData<
      C['Backend']['Update']['ReturnType'],
      C['Backend']['Update']['ErrorType']
    >
  ): BackendUpdateResponse<C>;
  private sendActions<
    C extends DatastoreCollectionType & DatastoreDeleteCollectionType
  >(
    baseAction: {
      readonly type: 'DELETE';
      readonly payload: DeleteRequestPayload<C>;
    },
    path: Path<C>,
    query: RawQuery<C['DocumentType']> | undefined,
    data: ResponseData<
      C['Backend']['Delete']['ReturnType'],
      C['Backend']['Delete']['ErrorType']
    >
  ): ResponseData<
    C['Backend']['Delete']['ReturnType'],
    C['Backend']['Delete']['ErrorType']
  >;
  private sendActions<
    C extends DatastoreCollectionType &
      DatastorePushCollectionType &
      DatastoreSetCollectionType &
      DatastoreUpdateCollectionType &
      DatastoreDeleteCollectionType
  >(
    baseAction:
      | { readonly type: 'PUSH'; readonly payload: PushRequestPayload<C> }
      | { readonly type: 'SET'; readonly payload: SetRequestPayload<C> }
      | { readonly type: 'UPDATE'; readonly payload: UpdateRequestPayload<C> }
      | { readonly type: 'DELETE'; readonly payload: DeleteRequestPayload<C> },
    path: Path<C>,
    query: RawQuery<C['DocumentType']> | undefined,
    data:
      | ResponseData<
          C['Backend']['Push']['ReturnType'],
          C['Backend']['Push']['ErrorType']
        >
      | ResponseData<
          C['Backend']['Set']['ReturnType'],
          C['Backend']['Set']['ErrorType']
        >
      | ResponseData<
          C['Backend']['Update']['ReturnType'],
          C['Backend']['Update']['ErrorType']
        >
      | ResponseData<
          C['Backend']['Delete']['ReturnType'],
          C['Backend']['Delete']['ErrorType']
        >,
    extractId?: ExtractIdFunction<C>
  ):
    | BackendPushResponse<C>
    | BackendSetResponse<C>
    | BackendUpdateResponse<C>
    | BackendDeleteResponse<C> {
    switch (data.status) {
      case 'success': {
        const action: CollectionActions<C> =
          baseAction.type === 'PUSH'
            ? ({
                type: 'API_PUSH_SUCCESS',
                payload: {
                  collection: baseAction.payload.collection,
                  ref: baseAction.payload.ref,
                  document: baseAction.payload.document,
                  rawRequest: baseAction.payload.rawRequest,
                  result: data.result,
                },
              } as CollectionActions<C>)
            : baseAction.type === 'SET'
            ? ({
                type: 'API_SET_SUCCESS',
                payload: {
                  collection: baseAction.payload.collection,
                  ref: baseAction.payload.ref,
                  document: baseAction.payload.document,
                  originalDocument: baseAction.payload.originalDocument,
                  rawRequest: baseAction.payload.rawRequest,
                  result: data.result,
                },
              } as CollectionActions<C>)
            : baseAction.type === 'UPDATE'
            ? ({
                type: 'API_UPDATE_SUCCESS',
                payload: {
                  collection: baseAction.payload.collection,
                  ref: baseAction.payload.ref,
                  delta: baseAction.payload.delta,
                  originalDocument: baseAction.payload.originalDocument,
                  rawRequest: baseAction.payload.rawRequest,
                  result: data.result,
                },
              } as CollectionActions<C>)
            : ({
                type: 'API_DELETE_SUCCESS',
                payload: {
                  collection: baseAction.payload.collection,
                  ref: baseAction.payload.ref,
                  originalDocument: baseAction.payload.originalDocument,
                  rawRequest: baseAction.payload.rawRequest,
                  result: data.result,
                },
              } as CollectionActions<C>);
        this.store$.dispatch(action);
        return baseAction.type === 'PUSH'
          ? ({
              status: 'success',
              id: extractId ? extractId(data.result) : (data.result as any)?.id,
            } as BackendSuccessResponse)
          : { status: 'success' };
      }
      default: {
        const action: CollectionActions<C> =
          baseAction.type === 'PUSH'
            ? ({
                type: 'API_PUSH_ERROR',
                payload: baseAction.payload,
              } as C extends DatastorePushCollectionType
                ? PushErrorAction<C>
                : never)
            : baseAction.type === 'SET'
            ? ({
                type: 'API_SET_ERROR',
                payload: baseAction.payload,
              } as C extends DatastoreSetCollectionType
                ? SetErrorAction<C>
                : never)
            : baseAction.type === 'UPDATE'
            ? ({
                type: 'API_UPDATE_ERROR',
                payload: baseAction.payload,
              } as C extends DatastoreUpdateCollectionType
                ? UpdateErrorAction<C>
                : never)
            : ({
                type: 'API_DELETE_ERROR',
                payload: baseAction.payload,
              } as C extends DatastoreDeleteCollectionType
                ? DeleteErrorAction<C>
                : never);
        this.store$.dispatch(action);
        return data;
      }
    }
  }
}

type BackendConfigFactory<C extends DatastoreCollectionType> = () => Backend<C>;

@NgModule({})
export class BackendRootModule {}

@NgModule({})
export class BackendModule {
  static forRoot(): ModuleWithProviders<BackendRootModule> {
    return {
      ngModule: BackendRootModule,
      providers: [BackendService],
    };
  }

  static forFeature<C extends DatastoreCollectionType>(
    collectionName: C['Name'],
    configFactory: BackendConfigFactory<C>
  ): ModuleWithProviders<BackendFeatureModule> {
    return {
      ngModule: BackendFeatureModule,
      providers: [
        {
          provide: BACKEND_COLLECTIONS,
          multi: true,
          useValue: collectionName,
        },
        {
          provide: BACKEND_CONFIGS,
          multi: true,
          useFactory: configFactory,
        },
      ],
    };
  }
}

export class DatastoreMissingModuleError extends Error {
  constructor(collectionName: string) {
    super(
      `Missing collection "${collectionName}".
        Check if you've imported Datastore${collectionName
          .charAt(0)
          .toUpperCase()}${collectionName.substring(
        1
      )}Module in the parent module of any component that needs it.`
    );
  }
}
