import { Observable, combineLatest, distinctUntilChanged, map, of } from 'rxjs';
import { arrayIsShallowEqual, toObservable } from 'src/util';
import {
  DatastoreCollectionType,
  QueryParam,
  QueryParams,
  RangeQueryParam,
  WhereFilterEqualsOp,
  WhereFilterInListOp,
  WhereFilterOp,
  WhereFilterRangeOp,
  WhereFilterStringComparisonOp,
} from './store.model';

export interface QueryObject<C extends DatastoreCollectionType> {
  readonly limit: number | undefined;
  readonly queryParams: QueryParams<C['DocumentType']>;
}

/**
 * Used to filter, limit objects in a collection. Refine your view of
 * the collection by adding clauses with their respective methods.
 *
 * Every method accepts an Observable in place of the value. If any clause
 * uses an Observable value, that Observable MUST emit something before the
 * collection can be fetched. By extension if you use multiple clauses, their
 * values must all emit before the collection can emit.
 */
export class Query<C extends DatastoreCollectionType> {
  private constructor(
    private readonly queryParams$:
      | Observable<QueryParams<C['DocumentType']>>
      | undefined,
    private readonly limitValue$: Observable<number> | undefined
  ) {}

  static newQuery<T extends DatastoreCollectionType>(): Query<T> {
    return new Query<T>(undefined, undefined);
  }

  /**
   * Adds criteria to refine the results of a collection query.
   * The `field` and `value` parameters must have matching types according
   * to the model file of the desired collection (see `<collection>.model.ts`).
   *
   * For example, if we want to query the 'projects' collection by title, our
   * where clause should look like:
   *
   * `.where('title', '==', 'someStringTitle')`
   *
   * Other exampls:
   * `.where('rating', '<=', 10)`
   * `.where('seoUrl', 'equalsIgnoreCase', seoUrl)`
   * `.where('completeStatus', 'in', [BidCompleteStatusApi.COMPLETE, BidCompleteStatusApi.PENDING])`,
   * `.where('members', 'includes', userId$)`,
   * `.where('location', 'nearby', { range: 150_000, latitude, longitude })`
   * `.where('skills', 'intersects', skills)`.
   */
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterEqualsOp,
    value$: C['DocumentType'][T] | Observable<C['DocumentType'][T]>
  ): Query<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterRangeOp,
    value$:
      | (C['DocumentType'][T] & (string | number))
      | Observable<C['DocumentType'][T] & (string | number)>
  ): Query<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterStringComparisonOp,
    value$:
      | (C['DocumentType'][T] & string)
      | Observable<C['DocumentType'][T] & string>
  ): Query<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterInListOp,
    value$:
      | readonly C['DocumentType'][T][]
      | Observable<readonly C['DocumentType'][T][]>
  ): Query<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterOp,
    value$: any
  ): Query<C> {
    // construct Query object from where function input
    const newParam$ = toObservable(value$).pipe(
      condition === 'in'
        ? distinctUntilChanged(arrayIsShallowEqual)
        : distinctUntilChanged(),
      map((value) => constructWhereCondition(field, condition, value))
    );

    if (this.queryParams$ === undefined) {
      return new Query(
        /* Ensure the type of the query is of the following structure
         *     queryParams: {
         *       name: [{ condition: '==', value: 'John' }]
         *     },
         */
        newParam$.pipe(
          map(
            (param) =>
              ({
                [field]: [param] as readonly QueryParam<C['DocumentType']>[],
              } as QueryParams<C['DocumentType']>)
          )
        ),
        this.limitValue$
      );
    }
    return new Query(
      combineLatest([this.queryParams$, newParam$]).pipe(
        map(([queryParams, newParam]) =>
          this.mergeParams(queryParams, newParam)
        ),
        distinctUntilChanged()
      ),
      this.limitValue$
    );
  }

  private mergeParams<T>(
    currParams: QueryParams<T>,
    newParam: QueryParam<T>
  ): QueryParams<T> {
    if (currParams[newParam.name]) {
      // Concat param under existing key
      return {
        ...currParams,
        [newParam.name]: [...(currParams[newParam.name] as any), newParam],
      };
    }

    return {
      ...currParams,
      [newParam.name]: [newParam],
    };
  }

  limit(number$: number | Observable<number>): Query<C> {
    if (this.limitValue$) {
      throw new Error("You can't call `limit` twice.");
    }
    return new Query(
      this.queryParams$,
      toObservable(number$).pipe(distinctUntilChanged())
    );
  }

  get query$(): Observable<QueryObject<C>> {
    return combineLatest([
      this.limitValue$ || of(undefined),
      this.queryParams$ || of({}),
    ]).pipe(
      map(([limit, queryParams]) => ({
        limit,
        queryParams,
      }))
    );
  }
}

/**
 * Not designed to be used outside this file except for mocks.
 */
export function constructWhereCondition<
  C extends DatastoreCollectionType,
  T extends keyof C['DocumentType'] = keyof C['DocumentType']
>(
  field: any, // -- TO-DO-- change this type back to T
  condition: WhereFilterOp,
  value: any
): QueryParam<C['DocumentType'], T> {
  // massive ternary is because otherwise type error
  return condition === 'in'
    ? { name: field, condition, values: value }
    : condition === '=='
    ? { name: field, condition, value }
    : condition === '<='
    ? { name: field, condition, value }
    : condition === '<'
    ? { name: field, condition, value }
    : condition === '>='
    ? { name: field, condition, value }
    : condition === '>'
    ? { name: field, condition, value }
    : { name: field, condition, value };
}

export function isInequalityParam<T>(
  param: QueryParam<T>
): param is RangeQueryParam<T, keyof T> {
  const op = param.condition;
  return op === '<=' || op === '>=' || op === '<' || op === '>';
}
