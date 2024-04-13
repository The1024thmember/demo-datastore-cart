import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RecursivePartial } from 'src/util';
import {
  BackendDeleteResponse,
  BackendPushResponse,
  BackendSetResponse,
  BackendUpdateResponse,
  DatastoreCollectionType,
  DatastoreConfig,
  DatastoreDeleteCollectionType,
  DatastorePushCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  PushDocumentType,
  Reference,
  SetDocumentType,
} from './store.model';

export const DATASTORE_CONFIG = new InjectionToken<DatastoreConfig>(
  'Datastore Configuration'
);

export interface StoreBackendInterface {
  push<C extends DatastoreCollectionType & DatastorePushCollectionType>(
    ref: Reference<C>,
    document: PushDocumentType<C>,
    extra?: { readonly [index: string]: string | number }
  ): Observable<BackendPushResponse<C>>;

  set<C extends DatastoreCollectionType & DatastoreSetCollectionType>(
    ref: Reference<C>,
    id: number | string,
    document: SetDocumentType<C>
  ): Observable<BackendSetResponse<C>>;

  update<C extends DatastoreCollectionType & DatastoreUpdateCollectionType>(
    ref: Reference<C>,
    id: number | string,
    delta: RecursivePartial<C['DocumentType']>
  ): Observable<BackendUpdateResponse<C>>;

  delete<C extends DatastoreCollectionType & DatastoreDeleteCollectionType>(
    ref: Reference<C>,
    id: number | string
  ): Observable<BackendDeleteResponse<C>>;
}
