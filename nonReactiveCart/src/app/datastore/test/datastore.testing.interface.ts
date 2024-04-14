import { isDefined } from 'src/util';
import { documentWithMetadataMatchesQueryParams } from '../abstractions/store.helpers';
import {
  BackendPushResponse,
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  DocumentWithMetadata,
  Reference,
} from '../abstractions/store.model';
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

export type IdOrIdsOrQuery<C extends DatastoreCollectionType> =
  | string
  | number
  | readonly string[]
  | readonly number[]
  | ((q: NonObservableQuery<C>) => NonObservableQuery<C>);

export abstract class DatastoreTestingInterface {
  /**
   * Creates an object directly in the store, without transformations.
   */
  abstract createRawDocument<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(
    collectionName: C['Name'],
    document: C['DocumentType']
  ): Promise<BackendPushResponse<any>>;

  /**
   * Add a transformer that will be used when creating new documents of a given
   * collection. Used to specify computed fields that would be returned by a
   * real backend, e.g. object ID.
   */
  abstract addPushTransformer<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(collectionName: C['Name'], transformer: PushTransformer<C>): void;

  /**
   * Add a transformer that will be used when updating documents of a given
   * collection. Used to replicate reducers that use the backend response rather
   * than the delta.
   */
  abstract addUpdateTransformer<
    C extends DatastoreCollectionType & DatastoreUpdateCollectionType
  >(collectionName: C['Name'], transformer: UpdateTransformer<C>): void;

  abstract addMutationPropagator<
    C1 extends DatastoreCollectionType & DatastorePushCollectionType,
    C2 extends DatastoreCollectionType & DatastorePushCollectionType
  >(propagator: MutationPropagator<C1, C2>): void;

  /**
   * Make all fetch requests to a particular datastore collection fail.
   */
  abstract makeCollectionFailFetch<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(collectionName: C['Name'], errorCode: FetchRequestErrorCode<C>): void;

  /**
   * Make all push requests to a particular datastore collection fail.
   * This includes calls to Datastore.createDocument().
   */
  abstract makeCollectionFailPush<
    C extends DatastoreCollectionType & DatastorePushCollectionType
  >(collectionName: C['Name'], errorCode: PushRequestErrorCode<C>): void;

  /**
   * Make all set requests to a particular datastore collection fail.
   */
  abstract makeCollectionFailSet<
    C extends DatastoreCollectionType & DatastoreSetCollectionType
  >(collectionName: C['Name'], errorCode: SetRequestErrorCode<C>): void;

  /**
   * Make all update requests to a particular datastore collection fail.
   */
  abstract makeCollectionFailUpdate<
    C extends DatastoreCollectionType & DatastoreUpdateCollectionType
  >(collectionName: C['Name'], errorCode: UpdateRequestErrorCode<C>): void;

  /**
   * Make all delete requests to a particular datastore collection fail.
   */
  abstract makeCollectionFailDelete<
    C extends DatastoreCollectionType & DatastoreDeleteCollectionType
  >(collectionName: C['Name'], errorCode: DeleteRequestErrorCode<C>): void;

  /**
   * Make a specific fetch request to the datastore fail.
   */
  abstract makeRequestFail<
    C extends DatastoreCollectionType & DatastoreFetchCollectionType
  >(
    collectionName: C['Name'],
    idOrIdsOrQuery: IdOrIdsOrQuery<C>,
    errorCode: FetchRequestErrorCode<C>
  ): void;
}

let debugEnabled = false;

export function debugConsoleLog(
  message?: unknown,
  ...optionalParams: unknown[]
): void {
  if (debugEnabled) {
    console.log(message, ...optionalParams);
  }
}

/** For test development only */
export function enableDebugMode(): void {
  debugEnabled = true;
}

/** For test development only */
export function disableDebugMode(): void {
  debugEnabled = false;
}

/**
 * Gets a list of documents which match a particular query. Unlike the real
 * datastore's equivalent `selectDocumentsForReference`, this does not return
 * cached documents. Instead, it only filters the documents directly via query
 * parameters, after applying search transformers.
 *
 * @param storeSlice the object after collection and authUid has been indexed
 * @param ref the reference for the requested data.
 * @param defaultOrder the default order of the collection
 * @param searchTransformers transforms results for search queries only
 *
 * @returns An array of documents
 */
export function getFakeDocuments<C extends DatastoreCollectionType>(
  storeSlice: FakeUserCollectionStateSlice<C>,
  ref: Reference<C>
): readonly C['DocumentType'][] {
  const {
    query,
    path: { collection },
  } = ref;

  if (!storeSlice) {
    debugConsoleLog(
      `'${collection}' collection has no documents. Did you intentionally omit creating a document?`
    );
    return [];
  }

  let documents: readonly DocumentWithMetadata<C['DocumentType']>[];
  documents = Object.values(storeSlice.documents);

  let matchingObjects: C['DocumentType'][];
  // If the reference is only for `ids` without a query, return those
  if (
    ref.path.ids &&
    (!ref.query ||
      !ref.query.queryParams ||
      Object.keys(ref.query.queryParams).length === 0)
  ) {
    matchingObjects = ref.path.ids
      .map((id) => storeSlice.documents[id])
      .filter(isDefined)
      .map((documentWithMetadata) => documentWithMetadata.rawDocument);
  } else {
    // Otherwise, it's a query - filter entities instead of the default list
    // (which the real datastore does)
    matchingObjects = documents
      .filter((documentWithMetadata) =>
        documentWithMetadataMatchesQueryParams(
          documentWithMetadata,
          query && query.queryParams
        )
      )
      .map((documentWithMetadata) => documentWithMetadata.rawDocument);
    // Don't apply the limit here, instead apply it inside the datastore.
    // This lets you easily calculate the total count for `approximateTotalCount`.
  }

  return matchingObjects.sort();
}
