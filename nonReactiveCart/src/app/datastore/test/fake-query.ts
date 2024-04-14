import { constructWhereCondition } from '../abstractions/query';
import {
  DatastoreCollectionType,
  QueryParams,
  WhereFilterEqualsOp,
  WhereFilterInListOp,
  WhereFilterOp,
  WhereFilterRangeOp,
  WhereFilterStringComparisonOp,
} from '../abstractions/store.model';

/**
 * This is a copy of Query, but that doesn't use observables.
 *
 * It is designed for specifying non-observable queries for the
 * datastore fake.
 */
export class NonObservableQuery<C extends DatastoreCollectionType> {
  private constructor(
    readonly queryParams: QueryParams<C['DocumentType']> | undefined,
    readonly limitValue: number | undefined
  ) {}

  static newQuery<T extends DatastoreCollectionType>(): NonObservableQuery<T> {
    return new NonObservableQuery<T>(undefined, undefined);
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
    value$: C['DocumentType'][T]
  ): NonObservableQuery<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterRangeOp,
    value$: C['DocumentType'][T] & (string | number)
  ): NonObservableQuery<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterStringComparisonOp,
    value$: C['DocumentType'][T] & string
  ): NonObservableQuery<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterInListOp,
    values$: readonly C['DocumentType'][T][]
  ): NonObservableQuery<C>;
  where<T extends keyof C['DocumentType']>(
    field: T,
    condition: WhereFilterOp,
    value: any
  ): NonObservableQuery<C> {
    const newParam = constructWhereCondition<C, T>(field, condition, value);

    return new NonObservableQuery(
      {
        ...this.queryParams,
        [newParam.name]: [
          ...(this.queryParams?.[newParam.name] ?? []),
          newParam,
        ],
      } as QueryParams<C['DocumentType']>,
      this.limitValue
    );
  }

  limit(n: number): NonObservableQuery<C> {
    return new NonObservableQuery(this.queryParams, n);
  }
}
