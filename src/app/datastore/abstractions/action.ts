import {
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreFetchCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  Delta,
  PushDocumentType,
  Reference,
  SetDocumentType,
} from './store.model';

export interface FetchSuccessAction<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> {
  readonly type: 'API_FETCH_SUCCESS';
  readonly payload: FetchSuccessPayload<C>;
}

export interface FetchErrorAction<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> {
  readonly type: 'API_FETCH_ERROR';
  readonly payload: FetchErrorPayload<C>;
}

export interface PushSuccessAction<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> {
  readonly type: 'API_PUSH_SUCCESS';
  readonly payload: PushSuccessPayload<C>;
}

export interface PushErrorAction<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> {
  readonly type: 'API_PUSH_ERROR';
  readonly payload: PushErrorPayload<C>;
}

export interface SetSuccessAction<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> {
  readonly type: 'API_SET_SUCCESS';
  readonly payload: SetSuccessPayload<C>;
}

export interface SetErrorAction<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> {
  readonly type: 'API_SET_ERROR';
  readonly payload: SetErrorPayload<C>;
}

export interface UpdateSuccessAction<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> {
  readonly type: 'API_UPDATE_SUCCESS';
  readonly payload: UpdateSuccessPayload<C>;
}

export interface UpdateErrorAction<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> {
  readonly type: 'API_UPDATE_ERROR';
  readonly payload: UpdateErrorPayload<C>;
}

export interface DeleteSuccessAction<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> {
  readonly type: 'API_DELETE_SUCCESS';
  readonly payload: DeleteSuccessPayload<C>;
}

export interface DeleteErrorAction<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> {
  readonly type: 'API_DELETE_ERROR';
  readonly payload: DeleteErrorPayload<C>;
}

export interface RequestDataAction<C extends DatastoreCollectionType> {
  readonly type: 'REQUEST_DATA';
  readonly payload: RequestDataPayload<C>;
}

export interface WsMessageAction<C extends DatastoreCollectionType> {
  readonly type: 'WS_MESSAGE';
  readonly payload: WebsocketActionPayload<C>;
}

interface BasePayload<C extends DatastoreCollectionType> {
  readonly collection: C['Name']; // While this is in the ref, this helps TypeScript do the discriminated union
  readonly ref: Reference<C>;
}

/****************************************
 *  Fetch                               *
 ****************************************/
interface FetchSuccessPayload<
  C extends DatastoreCollectionType & DatastoreFetchCollectionType
> extends BasePayload<C> {
  readonly result: C['Backend']['Fetch']['ReturnType'];
  readonly requestIds: readonly string[];
}

interface FetchErrorPayload<C extends DatastoreCollectionType>
  extends BasePayload<C> {
  readonly requestIds: readonly string[];
}

/****************************************
 *  Push                                *
 ****************************************/
export interface PushRequestPayload<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> extends BasePayload<C> {
  readonly document: PushDocumentType<C>;
  readonly rawRequest: C['Backend']['Push']['PayloadType'];
  readonly asFormData?: boolean;
}

export interface PushSuccessPayload<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> extends BasePayload<C> {
  readonly document: PushDocumentType<C>;
  readonly rawRequest: C['Backend']['Push']['PayloadType'];
  readonly result: C['Backend']['Push']['ReturnType'];
}

type PushErrorPayload<
  C extends DatastoreCollectionType & DatastorePushCollectionType
> = PushRequestPayload<C & DatastoreCollectionType>;

/****************************************
 *  Set                                 *
 ****************************************/

export interface SetRequestPayload<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> extends BasePayload<C> {
  readonly document: SetDocumentType<C>;
  readonly originalDocument?: SetDocumentType<C>;
  readonly rawRequest: C['Backend']['Set']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly asFormData?: boolean;
}

interface SetSuccessPayload<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> extends BasePayload<C> {
  readonly document: SetDocumentType<C>;
  readonly originalDocument: SetDocumentType<C>;
  readonly rawRequest: C['Backend']['Set']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly result: C['Backend']['Set']['ReturnType'];
}

type SetErrorPayload<
  C extends DatastoreCollectionType & DatastoreSetCollectionType
> = SetRequestPayload<C & DatastoreCollectionType>;

/****************************************
 *  Update                                 *
 ****************************************/

export interface UpdateRequestPayload<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> extends BasePayload<C> {
  readonly delta: Delta<C>;
  readonly originalDocument: C['DocumentType'];
  readonly rawRequest: C['Backend']['Update']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly asFormData?: boolean;
}

export interface UpdateSuccessPayload<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> extends BasePayload<C> {
  readonly delta: Delta<C>;
  readonly originalDocument: C['DocumentType'];
  readonly rawRequest: C['Backend']['Update']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly result: C['Backend']['Update']['ReturnType'];
}

type UpdateErrorPayload<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
> = UpdateRequestPayload<C & DatastoreCollectionType>;

/****************************************
 *  Delete                              *
 ****************************************/

export interface DeleteRequestPayload<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> extends BasePayload<C> {
  readonly originalDocument: C['DocumentType'];
  readonly rawRequest: C['Backend']['Delete']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly asFormData?: boolean;
}

interface DeleteSuccessPayload<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> extends BasePayload<C> {
  readonly originalDocument: C['DocumentType'];
  readonly rawRequest: C['Backend']['Delete']['PayloadType']; //  FIXME: T267853 - Do I need method?
  readonly result: C['Backend']['Delete']['ReturnType'];
}

type DeleteErrorPayload<
  C extends DatastoreCollectionType & DatastoreDeleteCollectionType
> = DeleteRequestPayload<C & DatastoreCollectionType>;

/****************************************
 *  Request data                        *
 ****************************************/

export interface RequestDataPayload<C extends DatastoreCollectionType>
  extends BasePayload<C> {
  readonly requestIds: readonly string[];
  readonly isRefetch?: boolean;
}

/****************************************
 *  Websocket                           *
 ****************************************/

export type WebsocketActionPayload<C extends DatastoreCollectionType> =
  C['Backend']['WebsocketType'] & {
    readonly toUserId: string;
  };

/**
 * List of actions corresponding to the root model.
 * Note: this is an extension of @ngrx/store's Action.
 */
export type CollectionActions<C extends DatastoreCollectionType> =
  // | { type: 'API_FETCH'; payload: FetchRequestPayload<T> }
  | (C extends DatastoreFetchCollectionType ? FetchSuccessAction<C> : never)
  | (C extends DatastoreFetchCollectionType ? FetchErrorAction<C> : never)
  | (C extends DatastorePushCollectionType ? PushSuccessAction<C> : never)
  | (C extends DatastorePushCollectionType ? PushErrorAction<C> : never)
  | (C extends DatastoreSetCollectionType ? SetSuccessAction<C> : never)
  | (C extends DatastoreSetCollectionType ? SetErrorAction<C> : never)
  | (C extends DatastoreUpdateCollectionType ? UpdateSuccessAction<C> : never)
  | (C extends DatastoreUpdateCollectionType ? UpdateErrorAction<C> : never)
  | (C extends DatastoreDeleteCollectionType ? DeleteSuccessAction<C> : never)
  | (C extends DatastoreDeleteCollectionType ? DeleteErrorAction<C> : never)
  | RequestDataAction<C>
  | WsMessageAction<C>;

/**
 * List of actions for every root model.
 */
export type TypedAction = CollectionActions<any>;

export function isRequestDataAction(a: TypedAction): a is {
  readonly type: 'REQUEST_DATA';
  readonly payload: RequestDataPayload<any>; // FIXME: T267853 -
} {
  return a.type === 'REQUEST_DATA';
}
