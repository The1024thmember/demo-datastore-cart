/**
 * Defines all the types of the store.
 */

import { RecursivePartial } from 'src/util';
import { RequestDataOptions } from './request-data';

interface ObjectWithId {
  readonly id: number | string;
}

export interface DatastoreCollectionType {
  readonly Name: string;
  readonly DocumentType: ObjectWithId;
  readonly Backend: {
    readonly Fetch?: BackendType;
    readonly Push?: BackendPushType;
    readonly Set?: BackendSetType;
    readonly Update?: BackendUpdateType;
    readonly Delete?: BackendType;
    readonly WebsocketType?: unknown;
  };
}

export interface BackendType {
  readonly PayloadType: object | undefined;
  readonly ReturnType: unknown;
  readonly ErrorType: unknown; // FIXME: T102623 - Change to ErrorCodeApi when T102623 is implemented
}

export interface BackendPushType extends BackendType {
  readonly ComputedFields: string;
  readonly HasIdExtractor?: boolean;
}
export interface BackendSetType extends BackendType {
  readonly ComputedFields: string;
}

export type BackendUpdateType = BackendType;

export type PushDocumentType<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = Omit<C['DocumentType'], C['Backend']['Push']['ComputedFields']>;

export type SetDocumentType<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = Omit<C['DocumentType'], C['Backend']['Set']['ComputedFields']>;

export interface QueryResults<C extends DatastoreCollectionType> {
  readonly [query: string]: QueryResult<C>;
}

export interface QueryResult<C extends DatastoreCollectionType> {
  readonly ids: readonly string[];
  readonly query: RawNonNullQuery<C['DocumentType']>;
}

export interface Pagination {
  readonly limit?: number;
  readonly offset?: number;
}

// This is the query object used internally by the datastore.
// The user facing API (datastore.list) uses the Query object which converts to this.
export interface RawNonNullQuery<T> extends Pagination {
  readonly queryParams: QueryParams<T> | undefined;
  readonly isDocumentQuery: boolean;
}

/**
 * Clauses/filters added by `query.where` are aggregated into this object, which
 * maps keys corresponding to the property name queried, to an array of clauses
 * under that property.
 *
 * If a key exists, it is guaranteed to have exactly one clause under it (see
 * query.ts#isValidWhereClause + mergeParams). One important exception is for
 * the inequality filters (`>`, `>=`, `<=`, `<`), which can have multiple
 * clauses to form a range.
 */
export type QueryParams<T> = {
  [K in keyof T]?: readonly QueryParam<T, K>[];
};

/**
 * Corresponds to a single clause added by `query.where`.
 */
export type QueryParam<T, K extends keyof T = keyof T> =
  | EqualsQueryParam<T, K>
  | RangeQueryParam<T, K>
  | StringEqualsQueryParam<T, K>
  | InListQueryParam<T, K>;

export interface EqualsQueryParam<T, K extends keyof T> {
  readonly name: K;
  readonly condition: WhereFilterEqualsOp;
  readonly value: T[K];
}
export interface RangeQueryParam<T, K extends keyof T> {
  readonly name: K;
  readonly condition: WhereFilterRangeOp;
  readonly value: T[K] & number;
}
export interface StringEqualsQueryParam<T, K extends keyof T> {
  readonly name: K;
  readonly condition: WhereFilterStringComparisonOp;
  readonly value: T[K] & string;
}
export interface InListQueryParam<T, K extends keyof T> {
  readonly name: K;
  readonly condition: WhereFilterInListOp;
  readonly values: readonly T[K][];
}

export type WhereFilterOp =
  | WhereFilterEqualsOp
  | WhereFilterRangeOp
  | WhereFilterStringComparisonOp
  | WhereFilterInListOp;

export type WhereFilterRangeOp = '<' | '<=' | '>=' | '>';
export type WhereFilterEqualsOp = '==';
export type WhereFilterStringComparisonOp = 'equalsIgnoreCase';
export type WhereFilterInListOp = 'in';

// A slice of the feature state corresponding to a particular user
export interface UserCollectionStateSlice<C extends DatastoreCollectionType> {
  readonly documents: Documents<C['DocumentType']>;
  readonly queries: QueryResults<C>;
}

export interface DocumentWithMetadata<T> {
  readonly rawDocument: T;
}

export interface Documents<T> {
  readonly [id: string]: DocumentWithMetadata<T>;
}

// Each collection (feature in NgRx terminology) has its own state, indexed by user ID
export interface CollectionStateSlice<C extends DatastoreCollectionType> {
  readonly [userId: string]: UserCollectionStateSlice<C>;
}

// Entire store is a JSON serialisable object, indexed by collection name
export interface StoreState {
  readonly [
    collectionName: string
  ]: CollectionStateSlice<DatastoreCollectionType>;
}
export interface Reference<C extends DatastoreCollectionType> {
  readonly path: Path<C>;
  readonly query?: RawQuery<C['DocumentType']>;
}

export type RawQuery<T> = RawNonNullQuery<T> | RawNullQuery;

/**
 * A query that has no query parameters and is not a search query.
 */
export interface RawNullQuery extends Pagination {
  readonly queryParams: undefined;
  readonly isDocumentQuery: boolean;
}
export interface Path<C> {
  readonly collection: DatastoreCollectionType['Name'];
  readonly authUid: string; // '0' if logged out
  readonly ids?: readonly string[];
}

export type Delta<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] // eslint-disable-line local-rules/readonly-array
    ? RecursivePartial<U>[] // eslint-disable-line local-rules/readonly-array
    : RecursivePartial<T[P]>;
};

/** An object with no keys or values */
export type EmptyObject = Record<string, never>;

export type BackendPushResponse<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = BackendPushSuccessResponse<C> | BackendPushErrorResponse<C>;
export type BackendSetResponse<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = BackendSuccessResponse | BackendSetErrorResponse<C>;
export type BackendUpdateResponse<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = BackendSuccessResponse | BackendUpdateErrorResponse<C>;
export type BackendDeleteResponse<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> = BackendSuccessResponse | BackendDeleteErrorResponse<C>;

export type BackendPushErrorResponse<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = BackendErrorResponse<C['Backend']['Push']['ErrorType']>;
export type BackendSetErrorResponse<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = BackendErrorResponse<C['Backend']['Set']['ErrorType']>;
export type BackendUpdateErrorResponse<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = BackendErrorResponse<C['Backend']['Update']['ErrorType']>;
export type BackendDeleteErrorResponse<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> = BackendErrorResponse<C['Backend']['Delete']['ErrorType']>;

export interface DatastoreFetchCollectionType {
  readonly Backend: { readonly Fetch: BackendType };
}

export interface DatastorePushCollectionType {
  readonly Backend: { readonly Push: BackendPushType };
}

export interface DatastoreSetCollectionType {
  readonly Backend: { readonly Set: BackendSetType };
}

export interface DatastoreUpdateCollectionType {
  readonly Backend: { readonly Update: BackendUpdateType };
}

export interface DatastoreDeleteCollectionType {
  readonly Backend: { readonly Delete: BackendType };
}

export interface BackendPushSuccessResponse<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> extends BackendSuccessResponse {
  readonly id: ExtractId<C>;
}

type ExtractId<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = C['Backend']['Push']['HasIdExtractor'] extends true
  ? DocumentId<C['DocumentType']['id']>
  : C['Backend']['Push']['ReturnType'] extends { readonly id: any }
  ? C['Backend']['Push']['ReturnType']['id']
  : undefined;

type DocumentId<T> = T extends number ? number : string;

export interface BackendErrorResponse<E> {
  readonly status: 'error';
  readonly errorCode: E | 'UNKNOWN_ERROR' | 'NETWORK_ERROR';
  readonly requestId?: string;
}

export interface BackendSuccessResponse {
  readonly status: 'success';
}

export type ApiFetchResponse<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> = ResponseData<
  C['Backend']['Fetch']['ReturnType'],
  C['Backend']['Fetch']['ErrorType']
>;

export type ResponseData<T, E> = SuccessResponseData<T> | ErrorResponseData<E>;

export interface SuccessResponseData<T> {
  readonly status: 'success';
  readonly result: T;
  readonly requestId?: string;
}

export type ErrorResponseData<E> = BackendErrorResponse<E>;

export type BackendFetchRequest<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> = BackendFetchPostRequest<C> | BackendFetchGetRequest;

/** Key-value pairs passed to the backend via query parameters in the URL */
export interface Params {
  readonly [key: string]:
    | string
    | number
    | boolean
    | readonly (number | undefined)[] // --TO-DO-- remove void
    | readonly (string | undefined)[]
    | undefined;
}

export interface BackendFetchGetRequest {
  readonly endpoint: string;
  readonly params?: Params;
}

interface BackendFetchPostRequest<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> {
  readonly payload: C['Backend']['Fetch']['PayloadType'];
  readonly endpoint: string;
  readonly params?: Params;
  /**
   * Serialises the body as `application/x-www-form-urlencoded` instead of
   * `application/json` (the default)
   */
  readonly asFormData?: boolean;
  readonly method: 'POST';
}

export interface BackendPushRequest<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> {
  readonly payload: C['Backend']['Push']['PayloadType'];
  readonly endpoint: string;
  readonly params?: Params;
  /**
   * Serialises the body as `application/x-www-form-urlencoded` instead of
   * `application/json` (the default)
   */
  readonly asFormData?: boolean;

  /** A selector function to retrieve the id of the newly created document */
  readonly extractId?: ExtractIdFunction<C>;
}

export type ExtractIdFunction<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = (result: C['Backend']['Push']['ReturnType']) => C['DocumentType']['id'];

export interface BackendSetRequest<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> {
  readonly payload: C['Backend']['Set']['PayloadType'];
  readonly endpoint: string;
  readonly params?: Params;
  /**
   * Serialises the body as `application/x-www-form-urlencoded` instead of
   * `application/json` (the default)
   */
  readonly asFormData?: boolean;
}

export interface BackendUpdateRequest<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> {
  readonly payload: C['Backend']['Update']['PayloadType'];
  readonly endpoint: string;
  readonly params?: Params;
  /**
   * Serialises the body as `application/x-www-form-urlencoded` instead of
   * `application/json` (the default)
   */
  readonly asFormData?: boolean;
  readonly method: 'POST' | 'PUT';
}

export interface BackendDeleteRequest<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> {
  readonly payload: C['Backend']['Delete']['PayloadType'];
  readonly endpoint: string;
  readonly params?: Params;
  readonly asFormData?: boolean;
  readonly method: 'POST' | 'PUT' | 'DELETE';
}

/** Auth user ID for logged-out use of the datastore */
export const LOGGED_OUT_KEY = '0';

export interface DatastoreConfig {
  readonly webSocketUrl: string;
  readonly enableStoreFreeze: boolean;
  readonly requestData: RequestDataOptions;
}

// A slice of the feature state corresponding to a particular user
export interface UserCollectionStateSlice<C extends DatastoreCollectionType> {
  readonly documents: Documents<C['DocumentType']>;
  readonly queries: QueryResults<C>;
}
