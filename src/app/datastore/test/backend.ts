import { ModuleWithProviders, NgModule } from '@angular/core';
import {
  asapScheduler,
  BehaviorSubject,
  delay,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { deepSpread, toNumber } from 'src/util';
import {
  Backend,
  BACKEND_COLLECTIONS,
  BACKEND_CONFIGS,
  BackendConfigs,
  BackendFeatureModule,
  BackendRootModule,
  BackendService,
} from '../abstractions/backend';
import { StoreBackendInterface } from '../abstractions/backend.interface';
import {
  addDocumentMetadata,
  mergeRawDocuments,
} from '../abstractions/store.helpers';
import {
  BackendDeleteResponse,
  BackendPushResponse,
  BackendSetResponse,
  BackendUpdateResponse,
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  Delta,
  PushDocumentType,
  Reference,
} from '../abstractions/store.model';
import { debugConsoleLog } from './datastore.testing.interface';
import {
  DeleteRequestErrorCode,
  FakeStoreState,
  FetchRequestErrorCode,
  MutationPropagator,
  PushRequestErrorCode,
  PushTransformer,
  SetRequestErrorCode,
  UpdateRequestErrorCode,
  UpdateTransformer,
} from './store.model';

/**
 * We can simulate either that the datastore errors, or never returns a result.
 */
export type SimulatedFetchRequestFailure<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> =
  | { readonly status: 'error'; readonly errorCode: FetchRequestErrorCode<C> }
  | { readonly status: 'pending' };

// makeCollectionPending() is simply not implemented for the other kinds of requests.
// As a result, there is no possible pending status for these types
export interface SimulatedPushRequestFailure<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> {
  readonly status: 'error';
  readonly errorCode: PushRequestErrorCode<C>;
}

export interface SimulatedSetRequestFailure<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> {
  readonly status: 'error';
  readonly errorCode: SetRequestErrorCode<C>;
}

export interface SimulatedUpdateRequestFailure<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> {
  readonly status: 'error';
  readonly errorCode: UpdateRequestErrorCode<C>;
}

export interface SimulatedDeleteRequestFailure<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> {
  readonly status: 'error';
  readonly errorCode: DeleteRequestErrorCode<C>;
}

export class FakeBackendService implements StoreBackendInterface {
  pushTransformers: Map<
    string,
    PushTransformer<DatastoreCollectionType & DatastorePushCollectionType>
  > = new Map();
  updateTransformers: Map<
    string,
    UpdateTransformer<DatastoreCollectionType & DatastoreUpdateCollectionType>
  > = new Map();
  mutationPropagators: readonly MutationPropagator<
    DatastoreCollectionType &
      DatastorePushCollectionType &
      DatastoreUpdateCollectionType,
    DatastoreCollectionType &
      DatastorePushCollectionType &
      DatastoreUpdateCollectionType
  >[] = [];

  private backendConfigs: BackendConfigs = {};

  private storeStateSubject$: BehaviorSubject<FakeStoreState> =
    new BehaviorSubject({});

  fetchCollectionsToFail: Map<string, SimulatedFetchRequestFailure<any>> =
    new Map();
  pushCollectionsToFail: Map<string, SimulatedPushRequestFailure<any>> =
    new Map();
  setCollectionsToFail: Map<string, SimulatedSetRequestFailure<any>> =
    new Map();
  updateCollectionsToFail: Map<string, SimulatedUpdateRequestFailure<any>> =
    new Map();
  deleteCollectionsToFail: Map<string, SimulatedDeleteRequestFailure<any>> =
    new Map();
  collectionsToFailWhenEmpty: Map<string, SimulatedFetchRequestFailure<any>> =
    new Map();

  requestsToFail: Map<string, SimulatedFetchRequestFailure<any>> = new Map();

  /** Map of collection name + request type to delay time */
  collectionsToDelay: Map<string, number> = new Map();

  private pushInternal<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    { path: { collection, authUid } }: Reference<C>,
    document: C['DocumentType']
  ): void {
    const storeState = this.storeStateSubject$.getValue();
    const collectionSlice = storeState[collection];

    if (collectionSlice === undefined) {
      this.storeStateSubject$.next({
        ...storeState,
        [collection]: {
          [authUid]: {
            documents: addDocumentMetadata([document]),
          },
        },
      });
    } else {
      const userCollectionSlice = collectionSlice[authUid];

      if (userCollectionSlice === undefined) {
        this.storeStateSubject$.next({
          ...storeState,
          [collection]: {
            ...collectionSlice,
            [authUid]: {
              documents: addDocumentMetadata([document]),
            },
          },
        });
      } else {
        this.storeStateSubject$.next({
          ...storeState,
          [collection]: {
            ...collectionSlice,
            [authUid]: {
              documents: mergeRawDocuments(
                // allow overwriting existing document with the new document
                userCollectionSlice.documents,
                addDocumentMetadata([document])
              ),
            },
          },
        });
      }
    }
  }

  storeState$ = this.storeStateSubject$.asObservable();

  isFeatureLoaded<C extends DatastoreCollectionType>(collection: any): boolean {
    return collection in this.backendConfigs;
  }

  addFeature<C extends DatastoreCollectionType>(
    collectionName: any,
    requestFactory: BackendConfigs[any]
  ): void {
    this.backendConfigs[collectionName] = requestFactory;
  }

  /** Pushes a document without transforming it or pushing to related collections. */
  pushRaw<C extends DatastoreCollectionType & DatastorePushCollectionType>(
    ref: Reference<C>,
    document: C['DocumentType']
  ): Observable<BackendPushResponse<C>> {
    return of(undefined).pipe(
      delay(0, asapScheduler),
      map(() => {
        debugConsoleLog(
          `Pushing to '${ref.path.collection}' raw document`,
          document
        );

        this.pushInternal(ref, document);

        return {
          status: 'success',
          id: (document as any).id,
        };
      })
    );
  }

  push<C extends DatastoreCollectionType & DatastorePushCollectionType>(
    ref: Reference<C>,
    document: PushDocumentType<C>,
    extra?: { readonly [index: string]: string | number }
  ): Observable<BackendPushResponse<C>> {
    let localExtra = { ...extra };
    const delayTime =
      this.collectionsToDelay.get(`${ref.path.collection}-push`) ?? 0;

    return of(undefined).pipe(
      delay(delayTime, asapScheduler),
      switchMap(() => {
        debugConsoleLog(
          `Pushing to '${ref.path.collection}' document`,
          document
        );

        const refCollection = ref.path.collection;
        const collectionFailure = this.pushCollectionsToFail.get(
          `${refCollection}`
        );

        if (collectionFailure?.status === 'error') {
          debugConsoleLog(
            `Push to '${ref.path.collection}' failing with error code ${collectionFailure.errorCode}`,
            document
          );
          return of({
            status: 'error',
            errorCode: collectionFailure.errorCode,
          } as const);
        }

        const collectionsToPush = this.getTargetCollections(
          refCollection,
          'push',
          this.mutationPropagators
        );

        let refDocumentId: string | number | undefined;
        collectionsToPush.forEach((collection, index) => {
          if (collection !== refCollection) {
            debugConsoleLog(
              `Pushing to '${collection}' document which is related to '${refCollection}'`,
              document
            );
          }

          if (index === 0 && collection !== refCollection) {
            debugConsoleLog(
              `First collection being pushed to ('${collection}') is not the ref collection (${refCollection}).'.
              'This might cause issues in any mutation propagators that expect the created ref collection document's id property to be set.`
            );
          }

          const pushTransformer = this.getPushTransformer(
            refCollection,
            collection,
            this.pushTransformers,
            this.mutationPropagators
          );

          const transformedDocument = pushTransformer(
            toNumber(ref.path.authUid),
            document,
            localExtra
          );

          if (collection === refCollection) {
            refDocumentId = transformedDocument.id;
            localExtra = { ...localExtra, refDocumentId };
          }

          this.pushInternal(
            { ...ref, path: { ...ref.path, collection } },
            transformedDocument
          );
        });

        return of({
          status: 'success',
          id: (refDocumentId as any) || 0,
        } as const);
      })
    );
  }

  set<C extends DatastoreCollectionType & DatastoreSetCollectionType>(
    { path: { collection, authUid } }: Reference<C>,
    id: number | string,
    document: C['DocumentType']
  ): Observable<BackendSetResponse<C>> {
    const delayTime = this.collectionsToDelay.get(`${collection}-set`) ?? 0;

    return of(undefined).pipe(
      delay(delayTime, asapScheduler),
      map(() => {
        debugConsoleLog(
          `Setting '${id}' in '${collection}' document`,
          document
        );

        const collectionFailure = this.setCollectionsToFail.get(
          `${collection}`
        );
        if (collectionFailure?.status === 'error') {
          debugConsoleLog(
            `Set on '${collection}' failing with error code ${collectionFailure.errorCode}`,
            document
          );
          return {
            status: 'error',
            errorCode: collectionFailure.errorCode,
          } as const;
        }

        const storeState = this.storeStateSubject$.getValue();
        const collectionSlice = storeState[collection];

        if (collectionSlice === undefined) {
          this.storeStateSubject$.next({
            ...storeState,
            [collection]: {
              [authUid]: {
                documents: addDocumentMetadata([document]),
              },
            },
          });
        } else {
          const userCollectionSlice = collectionSlice[authUid];

          if (userCollectionSlice === undefined) {
            this.storeStateSubject$.next({
              ...storeState,
              [collection]: {
                ...collectionSlice,
                [authUid]: {
                  documents: addDocumentMetadata([document]),
                },
              },
            });
          } else {
            this.storeStateSubject$.next({
              ...storeState,
              [collection]: {
                ...collectionSlice,
                [authUid]: {
                  documents: mergeRawDocuments(
                    userCollectionSlice.documents,
                    addDocumentMetadata([document])
                  ),
                },
              },
            });
          }
        }

        return { status: 'success' };
      })
    );
  }

  update<C extends DatastoreCollectionType & DatastoreUpdateCollectionType>(
    { path: { collection: refCollection, authUid } }: Reference<C>,
    id: number | string,
    delta: Delta<C['DocumentType']>
  ): Observable<BackendUpdateResponse<C>> {
    const delayTime =
      this.collectionsToDelay.get(`${refCollection}-update`) ?? 0;

    return of(undefined).pipe(
      delay(delayTime, asapScheduler),
      map(() => {
        debugConsoleLog(
          `Updating '${id}' in ${refCollection} with delta`,
          delta
        );

        const collectionFailure = this.updateCollectionsToFail.get(
          `${refCollection}`
        );
        if (collectionFailure?.status === 'error') {
          debugConsoleLog(
            `Push to '${refCollection}' failing with error code ${collectionFailure.errorCode}`,
            document
          );
          return {
            status: 'error',
            errorCode: collectionFailure.errorCode,
          } as const;
        }

        const collectionsToUpdate = this.getTargetCollections(
          refCollection,
          'update',
          this.mutationPropagators
        );

        for (const collection of collectionsToUpdate) {
          const storeState = this.storeStateSubject$.getValue();
          const collectionSlice = storeState[collection];
          if (collectionSlice === undefined) {
            debugConsoleLog(
              "Trying to merge into a collection that doesn't exist. Skipping"
            );
            return { status: 'success' };
          }

          const userCollectionSlice = collectionSlice[authUid];
          if (userCollectionSlice === undefined) {
            debugConsoleLog(
              "Trying to merge into a collection that doesn't exist for this user. Skipping"
            );
            return { status: 'success' };
          }

          const updatePropagator = this.getUpdatePropagator(
            refCollection,
            collection,
            this.mutationPropagators
          );

          let updatedDocument;
          if (updatePropagator) {
            // Update document in the related collection, applying the propagator transformer
            const refCollectionSlice = storeState[refCollection];
            if (refCollectionSlice === undefined) {
              throw new Error(
                `Cannot merge into a collection that doesn't exist`
              );
            }
            const userRefCollectionSlice = refCollectionSlice[authUid];
            if (userRefCollectionSlice === undefined) {
              throw new Error(
                `Cannot merge into a collection that doesn't exist for this user`
              );
            }

            const originalDocument =
              userRefCollectionSlice.documents[id].rawDocument;
            const targetDocumentId =
              updatePropagator.targetDocumentId(originalDocument);
            const targetDocument =
              userCollectionSlice.documents[targetDocumentId];
            if (!targetDocument) {
              throw new Error(
                `Document '${targetDocumentId}' in ${collection} could not be found while propagating updates from ${refCollection}`
              );
            }

            // Default to merging the delta if no propagator transformer is provided
            updatedDocument = updatePropagator.transformer
              ? updatePropagator.transformer(
                  toNumber(authUid),
                  delta as any, // FIXME: T267853 -
                  originalDocument,
                  targetDocument.rawDocument
                )
              : deepSpread(targetDocument.rawDocument, delta);

            debugConsoleLog(
              `Updating '${targetDocumentId}' in ${collection} which is related to '${refCollection}' with document`,
              updatedDocument
            );
          } else {
            // Update document in the original collection, applying the transformer
            // if present, otherwise merge the delta
            const originalDocument =
              userCollectionSlice.documents[id].rawDocument;
            const updateTransformer = this.updateTransformers.get(collection);
            updatedDocument = updateTransformer
              ? updateTransformer(
                  toNumber(authUid),
                  originalDocument,
                  delta as any
                ) // FIXME: T267853 -
              : deepSpread(originalDocument, delta);
          }

          this.storeStateSubject$.next({
            ...storeState,
            [collection]: {
              ...collectionSlice,
              [authUid]: {
                documents: mergeRawDocuments(
                  userCollectionSlice.documents,
                  addDocumentMetadata([updatedDocument])
                ),
              },
            },
          });
        }

        return { status: 'success' };
      })
    );
  }

  delete<C extends DatastoreCollectionType & DatastoreDeleteCollectionType>(
    { path: { collection, authUid } }: Reference<C>,
    id: number | string
  ): Observable<BackendDeleteResponse<C>> {
    const delayTime = this.collectionsToDelay.get(`${collection}-delete`) ?? 0;

    return of(undefined).pipe(
      delay(delayTime, asapScheduler),
      map(() => {
        debugConsoleLog(`Deleting '${id}' from ${collection}.`);

        const collectionFailure = this.deleteCollectionsToFail.get(
          `${collection}`
        );
        if (collectionFailure?.status === 'error') {
          debugConsoleLog(
            `Delete from '${collection}' failing with error code ${collectionFailure.errorCode}`,
            document
          );
          return {
            status: 'error',
            errorCode: collectionFailure.errorCode,
          } as const;
        }

        const storeState = this.storeStateSubject$.getValue();
        const collectionSlice = storeState[collection];

        if (collectionSlice === undefined) {
          debugConsoleLog(
            `Trying to delete from '${collection}' which doesn't exist. Skipping`
          );
          return { status: 'success' };
        }

        const userCollectionSlice = collectionSlice[authUid];
        if (userCollectionSlice === undefined) {
          debugConsoleLog(
            `Trying to delete from '${collection}' which doesn't exist for user ${authUid}. Skipping`
          );
          return { status: 'success' };
        }

        const documents = { ...userCollectionSlice.documents };
        delete documents[id];

        this.storeStateSubject$.next({
          ...storeState,
          [collection]: {
            ...collectionSlice,
            [authUid]: {
              documents,
            },
          },
        });
        return { status: 'success' };
      })
    );
  }

  private getPushTransformer<
    C1 extends DatastoreCollectionType,
    C2 extends DatastoreCollectionType
  >(
    originalCollection: C1['Name'],
    targetCollection: C2['Name'],
    pushTransformers: Map<
      string,
      PushTransformer<DatastoreCollectionType & DatastorePushCollectionType>
    >,
    mutationPropagators: readonly MutationPropagator<
      DatastoreCollectionType & DatastorePushCollectionType,
      DatastoreCollectionType & DatastorePushCollectionType
    >[]
  ): PushTransformer<DatastoreCollectionType & DatastorePushCollectionType> {
    // Use the propagator transformer instead of the push transformer if it has
    // been specified between two different collections
    if (originalCollection !== targetCollection) {
      const propagator = mutationPropagators.find(
        (p) =>
          p.from === originalCollection &&
          p.to === targetCollection &&
          p.config.push
      );

      if (!(propagator && propagator.config.push)) {
        debugConsoleLog(
          `Missing push propagator from '${originalCollection}' to '${targetCollection}'`
        );
        throw new Error(
          `Missing push propagator from '${originalCollection}' to '${targetCollection}'`
        );
      }

      return propagator.config.push;
    }

    const transformer = pushTransformers.get(targetCollection);
    if (!transformer) {
      // toPromise() on a `createDocument` call seems to swallow errors
      console.error(
        `Missing push transformer for collection '${targetCollection}'`
      );
      throw new Error(
        `Missing push transformer for collection '${targetCollection}'`
      );
    }
    return transformer;
  }

  private getUpdatePropagator<
    C1 extends DatastoreCollectionType & DatastorePushCollectionType,
    C2 extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    originalCollection: C1['Name'],
    targetCollection: C2['Name'],
    mutationPropagators: readonly MutationPropagator<
      DatastoreCollectionType &
        DatastorePushCollectionType &
        DatastoreUpdateCollectionType,
      DatastoreCollectionType &
        DatastorePushCollectionType &
        DatastoreUpdateCollectionType
    >[]
  ): MutationPropagator<C1, C2>['config']['update'] {
    if (originalCollection !== targetCollection) {
      const propagator = mutationPropagators.find(
        (p) =>
          p.from === originalCollection &&
          p.to === targetCollection &&
          p.config.update
      );

      if (!propagator) {
        debugConsoleLog(
          `Missing update propagator from '${originalCollection}' to '${targetCollection}'`
        );
        throw new Error(
          `Missing update propagator from '${originalCollection}' to '${targetCollection}'`
        );
      }

      return propagator.config.update;
    }

    return undefined;
  }

  // Get a list of collections to update.
  private getTargetCollections<C extends DatastoreCollectionType>(
    originalCollection: C['Name'],
    method: 'push' | 'update',
    mutationPropagators: readonly MutationPropagator<
      DatastoreCollectionType & DatastorePushCollectionType,
      DatastoreCollectionType & DatastorePushCollectionType
    >[]
  ): readonly C['Name'][] {
    const targets = new Set([originalCollection]);
    mutationPropagators.forEach((propagator) => {
      if (propagator.from === originalCollection && propagator.config[method]) {
        targets.add(propagator.to);
      }
    });
    return Array.from(targets);
  }

  /**
   * Clears the state, push transformers and resets errors.
   */
  reset<C extends DatastoreCollectionType>(
    authUid: string,
    collection?: C['Name']
  ): void {
    const storeState = this.storeStateSubject$.getValue();

    if (!collection) {
      debugConsoleLog(
        'Resetting the store to an empty state. You can ignore any "missing collection/document" warnings after this message.'
      );
      this.fetchCollectionsToFail.clear();
      this.pushCollectionsToFail.clear();
      this.setCollectionsToFail.clear();
      this.updateCollectionsToFail.clear();
      this.deleteCollectionsToFail.clear();
      this.collectionsToFailWhenEmpty.clear();
      this.collectionsToDelay.clear();
      this.requestsToFail.clear();
      this.pushTransformers.clear();
      this.updateTransformers.clear();
      this.mutationPropagators = [];
      this.storeStateSubject$.next({});
      return;
    }

    this.fetchCollectionsToFail.delete(collection);
    this.pushCollectionsToFail.delete(collection);
    this.setCollectionsToFail.delete(collection);
    this.updateCollectionsToFail.delete(collection);
    this.deleteCollectionsToFail.delete(collection);
    this.collectionsToDelay.delete(`${collection}-fetch`);
    this.collectionsToDelay.delete(`${collection}-push`);
    this.collectionsToDelay.delete(`${collection}-set`);
    this.collectionsToDelay.delete(`${collection}-update`);
    this.collectionsToDelay.delete(`${collection}-delete`);
    this.collectionsToFailWhenEmpty.delete(collection);
    this.requestsToFail.forEach((value, key) => {
      if (key.split(';')[0] === collection) {
        this.requestsToFail.delete(key);
      }
    });
    this.pushTransformers.delete(collection);
    this.updateTransformers.delete(collection);
    this.mutationPropagators = this.mutationPropagators.filter(
      (propagator) =>
        propagator.from === collection || propagator.to === collection
    );

    const collectionSlice = storeState[collection];
    if (collectionSlice === undefined) {
      debugConsoleLog(
        `Trying to reset '${collection}' which doesn't exist. Skipping`
      );
      return;
    }

    this.storeStateSubject$.next(
      collection
        ? {
            ...storeState,
            [collection]: {
              ...collectionSlice,
              [authUid]: {
                documents: {},
              },
            },
          }
        : {}
    );
  }
}

type BackendConfigFactory<C extends DatastoreCollectionType> = () => Backend<C>;

@NgModule({})
export class BackendFakeModule {
  static forRoot(): ModuleWithProviders<BackendRootModule> {
    return {
      ngModule: BackendRootModule,
      providers: [
        BackendService,
        { provide: BackendService, useExisting: FakeBackendService }, // BackendModule.forFeature
      ],
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
