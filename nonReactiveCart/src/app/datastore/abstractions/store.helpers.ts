import { Observable, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import {
  assertNever,
  filterObjectValues,
  isDefined,
  isEqual,
  jsonStableStringify,
  mapFilter,
  mapValues,
  partition,
  sameElements,
  setDiff,
  toObservable,
} from 'src/util';
import { Query, QueryObject, isInequalityParam } from './query';
import {
  CollectionStateSlice,
  DatastoreCollectionType,
  DocumentWithMetadata,
  Documents,
  InListQueryParam,
  Path,
  QueryParam,
  QueryParams,
  QueryResult,
  QueryResults,
  RangeQueryParam,
  RawNonNullQuery,
  RawQuery,
  Reference,
  StoreState,
  UserCollectionStateSlice,
} from './store.model';

/**
 * Gets the query param value of a specific query param name and returns it in
 * an array.
 *
 * Note that for the `intersects` and `equalsIgnoreTrue` param conditions, the
 * param value (which already must be an array) is wrapped inside another array.
 * E.g. For the query `query => query.where('skills', 'intersects', [1, 2, 3])`:
 * `getQueryParamValue(query, 'skills') => [[1, 2, 3]]`. See TODO below on why
 *
 * @param query The query.
 * @param name The key of the entity for the query.
 * @param valueSelector (optional) Maps the param value into a new value. This
 * can be useful when the param value is an object but you want to retrieve a
 * nested property.
 *
 * @returns An array of the values.
 */
// TODO: T267853 - Ideally this return type is consistently a flat array, i.e. if T[K] is
// an array, don't wrap it in another array. This could be achieved by conditional
// types pending resolution of https://github.com/Microsoft/TypeScript/issues/28917.
// In the meantime, we do this to ensure consistency with the type system and other
// `where` conditions which only work with array fields, e.g. 'includes',
// 'equalsIgnoreOrder' and 'intersects'
export function getQueryParamValue<T, K extends keyof T, R>(
  query: RawQuery<T> | undefined,
  name: K,
  valueSelector: (param: QueryParam<T, K>) => R
): readonly R[];
export function getQueryParamValue<T, K extends keyof T>(
  query: RawQuery<T> | undefined,
  name: K
): readonly T[K][];
export function getQueryParamValue<T, K extends keyof T, R>(
  query: RawQuery<T> | undefined,
  name: K,
  valueSelector?: (param: QueryParam<T, K>) => R
): readonly any[] {
  if (!query || !query.queryParams) {
    return [];
  }
  const selection = query.queryParams[name]; // QueryParam<T, K>[]. It is possible for a param to have multiple filter condition on it, eg: createTime <= 8 and createTime >= 5

  if (!selection) {
    return [];
  }

  const selectionValues = selection.reduce((acc, param) => {
    const value = valueSelector
      ? valueSelector(param)
      : isArrayParamValue(param)
      ? param.values
      : param.value;
    // 'in' is special case to make actual return value consistent
    // with the return type inferred by TypeScript
    switch (param.condition) {
      case 'in':
        return [...acc, ...(value as readonly any[])];
      default:
        return [...acc, value];
    }
  }, [] as readonly any[]);

  return selectionValues;
}

function isArrayParamValue<T, K extends keyof T>(
  param: QueryParam<T, K>
): param is InListQueryParam<T, K> {
  const isArrayParamCondition = param.condition === 'in';

  if (isArrayParamCondition && !Array.isArray((param as any).values)) {
    throw new Error(
      `Query parameter on field '${String(param.name)}' has condition '${
        param.condition
      }' but does not have an array value.`
    );
  }
  return isArrayParamCondition;
}
// RawQuery (internal query type) with an extra `order` field
type FlattenedQuery<C extends DatastoreCollectionType> = RawQuery<
  C['DocumentType']
>;
export const emptyQueryObject = {
  limit: undefined,
  queryParams: {},
};
/**
 * Turns a query function passed by datastore clients to an Observable of
 * its params and other properties (limit, order).
 *
 * There are 3 cases:
 * - queryFn is `undefined` or default (query => query) -> params to `{}`
 * - queryFn contains explicit clauses (where, limit, orderBy) -> params passed through
 *   - 'where' clauses with an empty 'in' parameter (i.e. `[]`) are filtered out
 * - queryFn is the null query -> params to `undefined`
 *
 * @returns flattened query used by #collection in the datastore
 */
export function flattenQuery<C extends DatastoreCollectionType>(
  queryFn?: (q: Query<C>) => Query<C> | Observable<Query<C>>
): Observable<FlattenedQuery<C>> {
  const queryObject$: Observable<QueryObject<C>> = queryFn
    ? toObservable(queryFn(Query.newQuery())).pipe(switchMap((q) => q.query$))
    : of(emptyQueryObject);

  return queryObject$.pipe(
    map((query) => ({
      ...query,
      isDocumentQuery: false,
      queryParams: query.queryParams,
    })),
    distinctUntilChanged(
      (x, y) =>
        stringifyReference({
          path: { collection: '', authUid: '' },
          query: x,
        }) ===
        stringifyReference({
          path: { collection: '', authUid: '' },
          query: y,
        })
    )
  );
}

/**
 * Stringifies a reference for indexing into the `queries` section of the
 * NgRx store.
 *
 * @param {Reference<DatastoreCollectionType>} ref - The reference to stringify.
 * @returns {string} The stringified reference.
 *  - If the reference has no query it returns `default`.
 *  - If the reference has a query and `ids` it includes the `ids` in the string.
 *
 * @performance
 * This function is in a hot path which means it is called often, so it has been optimized for performance.
 * - Object destructuring is used to avoid repeatedly accessing the same object properties.
 * - For small objects, Object.keys() is used to iterate over the properties of an object.
 * - Appends the stringified reference directly to the string array without creating a intermediate arrays.
 *
 * @example
 * const ref = {
 *   path: { ids: ['1', '2', '3'] },
 *   query: {
 *     queryParams: {
 *       name: [{ condition: '==', value: 'John' }]
 *     },
 *     limit: 10
 *   },
 *   order: [{ field: 'name', direction: 'asc' }]
 * };
 * const str = stringifyReference(ref); // 'limit==10;name=="John";id~in~"1","2","3";name~order0~asc'
 */
export function stringifyReference<C extends DatastoreCollectionType>(
  ref: Reference<C>
): string {
  const {
    path: { ids },
    query,
  } = ref;

  if (!query) {
    // undefined query - this can happen for no-query #collection calls or #object(s) calls
    return 'default';
  }

  // Extract necessary fields from query object for performance
  // optimization
  // - `queryParams` is an object containing individual query parameters
  // - `searchQueryParams` is a separate object containing search query
  //   parameters (not used in this code block)
  // - `limit` is the maximum number of results to return
  // - `offset` is the offset from which to start returning results
  //
  // By using destructuring, we avoid repeatedly accessing the same
  // object properties, which can be expensive in terms of performance.
  // We can then use these extracted fields in the rest of the code block
  // without incurring the performance overhead of accessing them through
  // the `query` object.
  const { queryParams, limit, offset } = query;

  // To optimize performance, we use the "push" method to directly append
  // the stringified reference to a string array. This approach is more
  // efficient than creating an intermediate array or using a loop to
  // concatenate strings, both of which can cause extra iterations and
  // memory overhead. By directly appending the string, we minimize memory
  // access and CPU ticks, resulting in faster execution.
  const entries: string[] = [];

  // Using Object.keys() to iterate over the properties of the query parameters
  // object may not be the most performant approach for very large objects, as it
  // creates an array of keys that could be expensive to generate. However, for small
  // objects like the queryParamsOrDefault object used in this function, Object.keys()
  // may be a reasonable choice.
  const queryParamsOrDefault: QueryParams<C['DocumentType']> =
    queryParams ?? {};
  for (const key of Object.keys(queryParamsOrDefault)) {
    const clauses = queryParamsOrDefault[key as keyof C['DocumentType']] ?? [];

    for (const param of clauses) {
      switch (param.condition) {
        case '==':
        case '<=':
        case '<':
        case '>=':
        case '>':
          entries.push(
            `${key}${param.condition}${jsonStableStringify(param.value, true)}`
          );
          break;
        case 'equalsIgnoreCase':
          entries.push(
            `${key}~${param.condition}~${jsonStableStringify(
              param.value,
              true
            )}`
          );
          break;
        case 'in':
          entries.push(
            `${key}~${param.condition}~${jsonStableStringify(
              param.values,
              true
            )}`
          );
          break;
        default:
          assertNever(param);
      }
    }
  }

  // Add pagination parameters to entries
  if (limit !== undefined) {
    entries.push(`limit==${limit}`);
  }
  if (offset !== undefined) {
    entries.push(`offset==${offset}`);
  }

  // Add IDs to entries
  if (ids) {
    const sortedIds = [...ids].sort();
    for (const sortedId of sortedIds) {
      entries.push(`id~in~${jsonStableStringify(sortedId, true)}`);
    }
  }

  if (entries.length === 0) {
    return 'default';
  }

  return entries.sort().join(';');
}

export function generateRequestId(): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + 16);
}

export interface QueryResultWithMetadata<C extends DatastoreCollectionType> {
  readonly documentsWithMetadata: readonly DocumentWithMetadata<
    C['DocumentType']
  >[];
}

export function getDocuments<C extends DatastoreCollectionType>(
  storeSlice: UserCollectionStateSlice<C>,
  ref: Reference<C>
): QueryResultWithMetadata<C> | undefined {
  if (!storeSlice) {
    return undefined;
  }

  // stringnify ref.query
  const queryString = stringifyReference(ref);

  // get that from storeSlice
  const queryResult = storeSlice.queries[queryString];
  if (queryResult) {
    const documentsWithMetadata = filterObjectValues(
      storeSlice.documents,
      isDefined,
      queryResult.ids
    );
    return {
      documentsWithMetadata, // Does this mean if we don't update the query list on every merge of new document in mergeDocument function, the result here might be outdated?
    };
  }

  // for UI test, hard filter on existing documents, since we only provide document for UI test
  const queryParams = ref.query?.queryParams;

  const documents = filterObjectValues(storeSlice.documents, (document) =>
    documentWithMetadataMatchesQueryParams(document, queryParams)
  ) as DocumentWithMetadata<C['DocumentType']>[];

  if (documents.length === 0) {
    return undefined;
  }

  const documentsWithMetadata = documents.slice(0, ref.query?.limit);

  return documentsWithMetadata.length > 0
    ? { documentsWithMetadata }
    : undefined;
}

/**
 * Checks if an document matches a query's params and returns the mismatched ones
 * If there are no params then it does so trivially.
 */
export function getMismatchedQueryParams<T>(
  documentWithMetadata: DocumentWithMetadata<T>,
  queryParams?: QueryParams<T>
): readonly QueryParams<T>[keyof T][] {
  if (!queryParams) {
    return [];
  }
  const mismatchedParams = Object.values<readonly QueryParam<T>[] | undefined>(
    queryParams
  ).filter((clauses) => {
    if (!clauses) {
      return false;
    }

    return isValidInterval(clauses)
      ? !clauses.every((param) =>
          paramMatchesdocumentWithMetadata(documentWithMetadata, param)
        )
      : !clauses.some((param) =>
          paramMatchesdocumentWithMetadata(documentWithMetadata, param)
        );
  });

  return mismatchedParams;
}

export function documentWithMetadataMatchesQueryParams<T>(
  documentWithMetadata: DocumentWithMetadata<T> | undefined,
  queryParams?: QueryParams<T>
): boolean {
  return (
    documentWithMetadata !== undefined &&
    getMismatchedQueryParams(documentWithMetadata, queryParams).length === 0
  );
}

/** Checks if query params form a valid bounded interval like a < x < b */
function isValidInterval<T, K extends keyof T>(
  params: readonly QueryParam<T, K>[]
): params is readonly [RangeQueryParam<T, K>, RangeQueryParam<T, K>] {
  const [firstParam, secondParam] = params;
  return (
    firstParam &&
    secondParam &&
    isInequalityParam(firstParam) &&
    isInequalityParam(secondParam) &&
    firstParam.condition.startsWith('>') &&
    secondParam.condition.startsWith('<') &&
    firstParam.value <= secondParam.value
  );
}

function paramMatchesdocumentWithMetadata<T>(
  documentWithMetadata: DocumentWithMetadata<T>,
  param: QueryParam<T>
): boolean {
  const documentValue = documentWithMetadata.rawDocument[param.name];

  if (documentValue) {
    switch (param.condition) {
      case '==':
        return isEqual(documentValue, param.value);
      case '<':
        return Number(documentValue) < param.value;
      case '<=':
        return Number(documentValue) <= param.value;
      case '>=':
        return Number(documentValue) >= param.value;
      case '>':
        return Number(documentValue) > param.value;
      case 'in':
        return param.values.some((value) => isEqual(documentValue, value));
      case 'equalsIgnoreCase':
        return (
          param.value.toUpperCase() === String(documentValue).toUpperCase()
        );
    }
  }

  return false;
}

export function pathsEqual<C extends DatastoreCollectionType>(
  a: Path<C>,
  b: Path<C>
): boolean {
  return (
    a.collection === b.collection &&
    a.authUid === b.authUid &&
    sameElements(a.ids || [], b.ids || [])
  );
}

export function referencesEqual<C extends DatastoreCollectionType>(
  a: Reference<C>,
  b: Reference<C>
): boolean {
  return (
    pathsEqual(a.path, b.path) &&
    stringifyReference(a) === stringifyReference(b)
  );
}

export function getOrignialDocument<C extends DatastoreCollectionType>(
  store: StoreState,
  path: Path<C>,
  id: string | number
): C['DocumentType'] | undefined {
  const slice = store[path.collection][path.authUid];
  return slice && slice.documents[id]
    ? slice.documents[id].rawDocument
    : undefined;
}

/** #document queries (by secondary ID) are not considered plain document references */
export function isPlainDocumentRef<C extends DatastoreCollectionType>(
  ref: Reference<C>
): boolean {
  if (ref.query?.queryParams) {
    const keys = Object.keys(ref.query.queryParams);
    const condition = keys.length === 1 && keys[0] === 'id';
    return condition;
  }
  return ref.query === undefined;
}

export function mergeDocument<C extends DatastoreCollectionType>(
  state: CollectionStateSlice<C>,
  rawDocuments: readonly C['DocumentType'][],
  ref: Reference<C>
): CollectionStateSlice<C> {
  const documents = addDocumentMetadata(rawDocuments);
  const originalUserCollectionSlice = state[ref.path.authUid];
  const userCollectionSlice: UserCollectionStateSlice<C> =
    originalUserCollectionSlice && originalUserCollectionSlice.documents
      ? originalUserCollectionSlice
      : {
          documents: {},
          queries: {},
        };

  const updatedDocuments = mergeRawDocuments(
    userCollectionSlice.documents,
    documents
  );

  const newListIds = rawDocuments.map((document) => document.id.toString());

  const queryString = isPlainDocumentRef(ref)
    ? undefined
    : stringifyReference(ref);

  const otherQueryResultsUpdated = mapValues(
    userCollectionSlice.queries,
    (queryResult, key) => {
      if (key === queryString) {
        return undefined;
      }
      return updateDocuments(queryResult, documents, updatedDocuments);
    },
    isDefined
  ) as QueryResults<C>;

  // we don't really care what the query are here, we only care about the ids of the document that matches the query
  const query: RawNonNullQuery<C['DocumentType']> = ref.query || {
    queryParams: {},
    isDocumentQuery: false,
  };
  // For plain `document` calls, merge all lists. For queried datastore calls, e.g.
  // `collection` and `document` by secondary ID, overwrite the current list
  // and merge all other lists.
  const updatedLists: QueryResults<C> = queryString
    ? {
        ...otherQueryResultsUpdated,
        [queryString]: {
          ids: newListIds,
          query,
        },
      }
    : otherQueryResultsUpdated;

  // Do we care about if new document matches existing queries? So that if the existing query is also match with the new document,
  // shall we extend the existing queries id to contain the new document id?
  // it can be complicated, eg: removal of document, update of document may require to go through all the queries and re-validate them one by one

  return {
    ...state,
    [ref.path.authUid]: {
      documents: updatedDocuments,
      queries: updatedLists,
    },
  };
}

export function removeDocumentById<C extends DatastoreCollectionType>(
  ref: Reference<C>,
  state: CollectionStateSlice<C>,
  id: string | number
): CollectionStateSlice<C> {
  const data = state[ref.path.authUid] || { queries: {}, documents: {} };
  const documents = { ...data.documents };
  delete documents[id];

  // Remove the deleted ID from any list
  const lists = Object.entries(data.queries).reduce(
    (obj, [queryString, list]) => {
      const newIds = (list?.ids ?? []).filter(
        (listId) => listId.toString() !== id.toString()
      );

      return {
        ...obj,
        [queryString]: sameElements(list?.ids ?? [], newIds)
          ? { ...list, ids: newIds }
          : { ...list, ids: newIds, timeUpdated: Date.now() },
      };
    },
    {} as QueryResults<C>
  );

  return {
    ...state,
    [ref.path.authUid]: { documents, queries: lists },
  };
}

interface ObjectWithId {
  readonly id: number | string;
}

export function addDocumentMetadata<T extends ObjectWithId>(
  rawDocuments: readonly T[]
): Documents<T> {
  return rawDocuments.reduce(
    (acc, rawDocument) => {
      acc[rawDocument.id] = {
        rawDocument,
      };
      return acc;
    },
    // We can't use {} as Documents<T> here because it will cause
    // index signature errors when we try to assign to it.
    {} as { [id: string]: DocumentWithMetadata<T> }
  );
}

export function mergeWebsocketDocuments<C extends DatastoreCollectionType>(
  state: CollectionStateSlice<C>,
  rawDocuments: readonly C['DocumentType'][],
  ref: Reference<C>
): CollectionStateSlice<C> {
  const documents = addDocumentMetadata(rawDocuments);
  const slice = state[ref.path.authUid];
  const storeSlice =
    slice && slice.documents
      ? slice
      : {
          documents: {},
          queries: {},
        };

  const updatedDocuments = mergeRawDocuments(storeSlice.documents, documents);

  if (!storeSlice.queries) {
    return state;
  }

  const updatedQueryResult: QueryResults<C> = mapValues(
    storeSlice.queries,
    (list) => updateDocuments(list, documents, updatedDocuments)
  );

  return {
    ...state,
    [ref.path.authUid]: {
      documents: updatedDocuments,
      queries: { ...storeSlice.queries, ...updatedQueryResult },
    },
  };
}

/**
 * Merges the unwrapped documents of a collection, only overwriting the ones
 * that have changed.
 */
export function mergeRawDocuments<C extends DatastoreCollectionType>(
  currentDocuments: Documents<C['DocumentType']>,
  newDocuments: Documents<C['DocumentType']>
): Documents<C['DocumentType']> {
  // The `newDocuments`, keeping the unwrapped object from `currentDocuments` but
  // with updated metadata (timeFetched/updated) if they compare deep equal,
  const updatedNewDocuments = mapValues(newDocuments, (newDocument, key) =>
    key in currentDocuments &&
    isEqual(currentDocuments[key].rawDocument, newDocument.rawDocument, {
      ignoreUndefinedObjectProperties: true,
    })
      ? {
          ...newDocument,
          rawDocument: currentDocuments[key].rawDocument,
        }
      : newDocument
  );

  return {
    ...currentDocuments,
    ...updatedNewDocuments,
  };
}

export function filterNotEmptyFields<C extends DatastoreCollectionType>(
  payload: Documents<C['DocumentType']>
) {
  // Use Object.entries() to get an array of key-value pairs
  return Object.fromEntries(
    Object.entries(payload)
      // Filter out entries where the value is not empty
      .filter(([key, value]) => value !== null && value !== undefined)
  );
}

function updateDocuments<C extends DatastoreCollectionType>(
  queryResult: QueryResult<C>,
  documents: Documents<C['DocumentType']>,
  updatedDocuments: Documents<C['DocumentType']>
): QueryResult<C> {
  const { query } = queryResult;
  const { queryParams, offset, limit } = query;

  // If the offset is non-zero we don't add it to the new list.
  if (offset) {
    return queryResult;
  }

  // Existing document ids of the old list
  const currDocumentIds = queryResult ? Array.from(queryResult.ids) : [];

  // Find which documents modified by the websocket now match (or don't match)
  // the query. These should be added (or removed) from the list
  const [matchingIds, nonMatchingIds] = partition(
    Object.entries(documents),
    ([, documentWithMetadata]) =>
      documentWithMetadataMatchesQueryParams(documentWithMetadata, queryParams)
  ).map((entityEntries) => entityEntries.map(([documentId]) => documentId));

  // The new list is the old list plus any matching document ids, minus any
  // non-matching document ids, while ensuring all ids are unique
  const filteredDocumentIds = setDiff(
    currDocumentIds.concat(matchingIds),
    nonMatchingIds
  );

  // Finally, apply limit to the ids before merging into list
  const updatedDocumentIds = [...filteredDocumentIds].sort().slice(0, limit);

  return sameElements(currDocumentIds, updatedDocumentIds)
    ? { ...queryResult, ids: updatedDocumentIds }
    : { ...queryResult, ids: updatedDocumentIds };
}

export function documentTransformer<T extends ObjectWithId, O>(
  list: readonly O[] | { readonly [id: number]: O | undefined } | undefined,
  transform: (a: NonNullable<O>) => T
): readonly T[];

export function documentTransformer<T extends ObjectWithId, O, E>(
  list: readonly O[] | { readonly [id: number]: O | undefined } | undefined,
  transform: (a: NonNullable<O>, extra: E) => T,
  extra: E
): readonly T[];
export function documentTransformer<T extends ObjectWithId, O, E>(
  list: readonly O[] | { readonly [id: number]: O | undefined } | undefined,
  transform: (a: NonNullable<O>, extra?: E) => T,
  extra?: E
): readonly T[] {
  if (!list) {
    return [];
  }

  const actualList: readonly (O | undefined)[] = Array.isArray(list)
    ? list
    : Object.values<O | undefined>(list);
  return mapFilter(
    actualList,
    (element) => (isDefined(element) ? transform(element, extra) : undefined),
    isDefined
  );
}
