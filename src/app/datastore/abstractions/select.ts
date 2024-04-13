import type { Observable } from 'rxjs';
import { pipe } from 'rxjs';
import { distinctUntilChanged, map, pluck } from 'rxjs/operators';

/**
 * This is `select` from ngrx/store pulled out into a pipeable operator with the
 * the type definitions fixed as per https://github.com/ngrx/platform/issues/528
 */
export function select<T, K>(
  mapFn: (state: T) => K
): (source$: Observable<T>) => Observable<K | undefined>;
export function select<T, a extends keyof T>(
  key: a
): (source$: Observable<T>) => Observable<T[a] | undefined>;
export function select<T, a extends keyof T, b extends keyof NonNullable<T[a]>>(
  key1: a,
  key2: b
): (source$: Observable<T>) => Observable<NonNullable<T[a]>[b] | undefined>;
export function select<
  T,
  a extends keyof T,
  b extends keyof NonNullable<T[a]>,
  c extends keyof NonNullable<NonNullable<T[a]>[b]>
>(
  key1: a,
  key2: b,
  key3: c
): (
  source$: Observable<T>
) => Observable<NonNullable<NonNullable<T[a]>[b]>[c] | undefined>;
export function select<
  T,
  a extends keyof T,
  b extends keyof NonNullable<T[a]>,
  c extends keyof NonNullable<NonNullable<T[a]>[b]>,
  d extends keyof NonNullable<NonNullable<T[a]>[b]>[c]
>(
  key1: a,
  key2: b,
  key3: c,
  key4: d
): (
  source$: Observable<T>
) => Observable<NonNullable<NonNullable<T[a]>[b]>[c][d] | undefined>;
export function select<
  T,
  a extends keyof T,
  b extends keyof NonNullable<T[a]>,
  c extends keyof NonNullable<NonNullable<T[a]>[b]>,
  d extends keyof NonNullable<NonNullable<NonNullable<T[a]>[b]>[c]>,
  e extends keyof NonNullable<NonNullable<NonNullable<NonNullable<T[a]>[b]>[c]>[d]> // prettier-ignore
>(
  key1: a,
  key2: b,
  key3: c,
  key4: d,
  key5: e,
): (
  source$: Observable<T>,
) => Observable<NonNullable<NonNullable<NonNullable<NonNullable<T[a]>[b]>[c]>[d]>[e] | undefined>; // prettier-ignore
export function select<T>(
  pathOrMapFn: ((state: T) => any) | string,
  ...paths: string[]
): (source$: Observable<T>) => Observable<any> {
  if (typeof pathOrMapFn === 'string') {
    // FIXME: T255116 - Refactor this function to not use pluck
    return pipe(pluck(pathOrMapFn, ...paths), distinctUntilChanged());
  }
  if (typeof pathOrMapFn === 'function') {
    return pipe(map(pathOrMapFn), distinctUntilChanged());
  }

  throw new TypeError(
    `Unexpected type '${typeof pathOrMapFn}' in select operator,` +
      ` expected 'string' or 'function'`
  );
}
