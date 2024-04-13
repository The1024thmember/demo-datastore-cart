import {
  Observable,
  distinctUntilChanged,
  firstValueFrom,
  map,
  switchMap,
  take,
} from 'rxjs';
import { RecursivePartial, arrayIsShallowEqual } from 'src/util';
import { StoreBackendInterface } from './backend.interface';
import { RequestStatus } from './requestStatusHandler';
import { QueryResultWithMetadata } from './store.helpers';
import {
  BackendDeleteResponse,
  BackendSetResponse,
  BackendUpdateResponse,
  DatastoreCollectionType,
  DatastoreDeleteCollectionType,
  DatastoreSetCollectionType,
  DatastoreUpdateCollectionType,
  Reference,
  SetDocumentType,
} from './store.model';

export class Documents<C extends DatastoreCollectionType> {
  private valueChanges$: Observable<readonly C['DocumentType'][]>;

  constructor(
    private ref$: Observable<Reference<C>>,
    private queryResult$: Observable<QueryResultWithMetadata<C>>,
    public status$: Observable<RequestStatus<C>>,
    private backendService: StoreBackendInterface
  ) {
    /**
     * This should be moved to `valueChanges()` but it causes issues
     * when you do `valueChanges() | flasync` in a template.
     * We should wean people off doing this, but until then
     * this needs to be in the constructor.
     */
    this.valueChanges$ = this.queryResult$.pipe(
      map((queryResult) =>
        queryResult.documentsWithMetadata.map(
          (documentWithMetadata: { rawDocument: any }) =>
            documentWithMetadata.rawDocument
        )
      ),
      distinctUntilChanged(arrayIsShallowEqual)
    );
  }

  /**
   * Return an array of all documents in a collection for a given query,
   * emitting changes as the occur.
   */
  valueChanges(): Observable<readonly C['DocumentType'][]> {
    return this.valueChanges$;
  }

  // partial update
  update(
    id: number | string, // Make calling this function fail if you haven't defined `C['Backend']['Update']`
    delta: C['Backend']['Update'] extends never
      ? never
      : RecursivePartial<C['DocumentType']>
  ): Promise<
    BackendUpdateResponse<
      DatastoreCollectionType & DatastoreUpdateCollectionType
    >
  > {
    return firstValueFrom(
      this.ref$.pipe(
        switchMap((ref) => {
          return this.backendService.update(ref, id, delta);
        })
      )
    );
  }

  // update the whole document or create new document
  set(
    id: number | string,
    // Make calling this function fail if you haven't defined `C['Backend']['Set']`
    document: C extends DatastoreSetCollectionType ? SetDocumentType<C> : never
  ): Promise<
    BackendSetResponse<DatastoreCollectionType & DatastoreSetCollectionType>
  > {
    return firstValueFrom(
      this.ref$.pipe(
        take(1),
        map((ref) => ref as unknown as Reference<C>), // Unfortunate type casting
        switchMap((ref) => this.backendService.set(ref, id, document))
      )
    );
  }

  // delete a document
  remove(
    id: number | string
  ): Promise<
    BackendDeleteResponse<
      DatastoreCollectionType & DatastoreDeleteCollectionType
    >
  > {
    return firstValueFrom(
      this.ref$.pipe(
        switchMap((ref) => {
          return this.backendService.delete(ref, id);
        })
      )
    );
  }
}
