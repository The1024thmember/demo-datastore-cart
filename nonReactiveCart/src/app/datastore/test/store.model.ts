import {
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  Documents,
  PushDocumentType,
} from '../abstractions/store.model';

/**
 * Transforms a (partial) document into a document for the purposes of emulating
 * computed fields in the fake Datastore.
 */
export type PushTransformer<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = (
  authUid: number,
  document: PushDocumentType<C> & Partial<Pick<C['DocumentType'], 'id'>>,
  extra?: { readonly [index: string]: string | number }
) => C['DocumentType'];

/**
 * Transforms a doucment from a collection to another collection
 */
export interface MutationPropagator<
  C1 extends DatastoreCollectionType & DatastorePushCollectionType,
  C2 extends DatastoreCollectionType & DatastorePushCollectionType
> {
  readonly from: C1['Name'];
  readonly to: C2['Name'];
  readonly config: {
    readonly update?: {
      targetDocumentId(
        originalDocument: C1['DocumentType']
      ): C2['DocumentType']['id'];
      transformer?(
        authUid: number,
        delta: Partial<C1['DocumentType']>,
        originalDocument: C1['DocumentType'],
        targetDocument: C2['DocumentType']
      ): C2['DocumentType'];
    };
    push?(
      authUid: number,
      document: PushDocumentType<C1> & Partial<Pick<C1['DocumentType'], 'id'>>,
      extra?: { readonly [index: string]: string | number }
    ): C2['DocumentType'];
  };
}

/**
 * Recreates reducer logic missing from the fake datastore for document updates.
 */
export type UpdateTransformer<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = (
  authUid: number,
  document: C['DocumentType'],
  delta: Partial<C['DocumentType']>
) => C['DocumentType'];

export type FetchRequestErrorCode<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> = C['Backend']['Fetch']['ErrorType'] | 'UNKNOWN_ERROR';

export type PushRequestErrorCode<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = C['Backend']['Push']['ErrorType'] | 'UNKNOWN_ERROR';

export type SetRequestErrorCode<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = C['Backend']['Set']['ErrorType'] | 'UNKNOWN_ERROR';

export type UpdateRequestErrorCode<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = C['Backend']['Update']['ErrorType'] | 'UNKNOWN_ERROR';

export type DeleteRequestErrorCode<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> = C['Backend']['Delete']['ErrorType'] | 'UNKNOWN_ERROR';

// A slice of the feature state corresponding to a particular user
export interface FakeUserCollectionStateSlice<
  C extends DatastoreCollectionType
> {
  readonly documents: Documents<C['DocumentType']>;
}

// Each collection or feature has its own state, indexed by user ID
export interface FakeCollectionStateSlice<C extends DatastoreCollectionType> {
  readonly [userId: string]: FakeUserCollectionStateSlice<C> | undefined;
}

// Entire store is a JSON serialisable object, indexed by collection name
export interface FakeStoreState {
  readonly [
    collectionName: string
  ]: FakeCollectionStateSlice<DatastoreCollectionType>;
}
