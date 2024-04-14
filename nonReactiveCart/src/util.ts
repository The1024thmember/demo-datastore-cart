import { Observable, isObservable, of } from 'rxjs';

export function isDefined<T>(x: T): x is NonNullable<T> {
  return x !== undefined && x !== null;
}

export function toObservable<T>(x$: T | Observable<T>): Observable<T> {
  return isObservable(x$) ? x$ : of(x$);
}

export function arrayIsShallowEqual<T>(
  a?: readonly T[],
  b?: readonly T[]
): boolean {
  return Boolean(
    a &&
      b &&
      a.length === b.length &&
      a.every((entity, index) => entity === b[index])
  );
}

/** A version of JSON.stringify that sorts object keys
 * (and optionally array entries) for a stable sort.
 * Useful for using as an object's hash.
 *
 * Based on https://github.com/substack/json-stable-stringify
 */
export function jsonStableStringify(
  node: any,
  sortArrays = false
): string | undefined {
  if (node && node.toJSON && typeof node.toJSON === 'function') {
    // eslint-disable-next-line no-param-reassign
    node = node.toJSON();
  }

  if (node === undefined) {
    return;
  }

  if (typeof node !== 'object' || node === null) {
    return JSON.stringify(node);
  }

  if (Array.isArray(node)) {
    return `[${(sortArrays ? [...node].sort() : node)
      .map(
        (value) =>
          jsonStableStringify(value, sortArrays) || JSON.stringify(null)
      )
      .join(',')}]`;
  }

  return `{${Object.keys(node)
    .sort()
    .map((key) => {
      const value = jsonStableStringify(node[key], sortArrays);
      return value ? `${JSON.stringify(key)}:${value}` : undefined;
    })
    .filter(isDefined)
    .join(',')}}`;
}

export function assertNever(
  x: never,
  error: string = 'Unexpected object'
): never {
  throw new Error(`${error}: ${JSON.stringify(x)}`);
}

/**
 * * Returns an array of values from an object that pass a given filter function.
 *
 * @param object - An object with string keys and values of generic type `V`.
 * @param filter - A function that takes in a value of type `V` and returns a boolean to indicate whether the value should be included in the output.
 * @param keys - An optional array of string keys to filter on. If not provided, all keys in the object will be used.
 *
 * @returns An array of values of type `V` that pass the filter function.
 */
export function filterObjectValues<V>(
  object: { [K in string]: V },
  filter: (value: V) => boolean = () => true,
  keys: readonly string[] | undefined = Object.keys(object)
): readonly V[] {
  const values: V[] = [];

  for (const key of keys) {
    const value = object[key];

    if (filter(value)) {
      values.push(value);
    }
  }

  return values;
}

/** Performs a deep comparison between two values to determine if they are equivalent.
 *
 * Signature same as lodash
 * @param value The value to compare.
 * @param other The other value to compare.
 * @returns Returns `true` if the values are equivalent, else `false`.
 */
export function isEqual(
  a: any,
  b: any,
  comparisonOptions?: EqualityComparisonOptions
): boolean {
  if (a === b) {
    return true;
  }

  // handle the case when query by ids the document metadata id is int while the query.value is string
  if (a == b && parseInt(a) === parseInt(b)) {
    return true;
  }

  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => isEqual(value, b[i], comparisonOptions))
    );
  }

  if (a instanceof Date) {
    return b instanceof Date && a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return b instanceof RegExp && a.toString() === b.toString();
  }

  if (a instanceof Object && b instanceof Object) {
    const keysA = Object.keys(a).filter((key) =>
      comparisonOptions?.ignoreUndefinedObjectProperties
        ? a[key] !== undefined
        : true
    );
    const keysB = Object.keys(b).filter((key) =>
      comparisonOptions?.ignoreUndefinedObjectProperties
        ? b[key] !== undefined
        : true
    );

    return (
      keysA.length === keysB.length &&
      keysA.every(
        (key) =>
          keysB.includes(key) && isEqual(a[key], b[key], comparisonOptions)
      )
    );
  }

  return false;
}

export interface EqualityComparisonOptions {
  readonly ignoreUndefinedObjectProperties?: boolean;
}

export function sameElements<T>(as: readonly T[], bs: readonly T[]): boolean {
  const setAs = new Set(as);
  const setBs = new Set(bs);
  return as.every((a) => setBs.has(a)) && bs.every((b) => setAs.has(b));
}

export function isObject(item: unknown): item is object {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Creates an object with the same keys as `object` and values generated
 * by running each own enumerable string keyed property of `object` thru
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, key, object).
 *
 * @param {Object} object The object to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {Function} [filter=undefined] The function to filter the iteratee return value.
 * @returns {Object} Returns the new mapped object.
 * @example
 *
 * const users = {
 *   'fred':    { 'user': 'fred',    'age': 40 },
 *   'pebbles': { 'user': 'pebbles', 'age': 1 }
 * };
 *
 * _.mapValues(users, o => o.age);
 * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
 */
export function mapValues<T, S>(
  object: { readonly [key: string]: T },
  iteratee: (x: T, y: string) => S,
  filter?: (value: S) => boolean
): {
  readonly [key: string]: S;
};
export function mapValues<T, S, E extends string | number | symbol = string>(
  object: { readonly [key in E]?: T },
  iteratee: (x: T | undefined, y: string) => S,
  filter?: (value: S) => boolean
): {
  readonly [key in E]?: S;
};
export function mapValues<T, S, E extends string | number | symbol = string>(
  object: { readonly [key in E]?: T },
  iteratee: (x: T | undefined, y: string) => S,
  filter: ((value: S) => boolean) | undefined = undefined
): {
  readonly [key in E]?: S;
} {
  const result: { [key in E]?: S } = {};
  for (const key of Object.keys(object)) {
    const value = iteratee(object[key as E], key);
    if (!filter || filter(value)) {
      result[key as E] = value;
    }
  }
  return result;
}

/**
 * Maps each element of an array to a new value and then filters the resulting array.
 *
 * @param array - The input array to map and filter.
 * @param mapper - The function to map each element of the input array to a new value.
 * @param filter - The function used to filter the results. Returns true if the element should be included in the final array, false otherwise.
 *
 * @returns The new array of mapped and filtered values.
 */
export function mapFilter<T, U>(
  array: readonly T[],
  mapper: (element: T) => U,
  filter: (element: U) => element is NonNullable<U>
): NonNullable<U>[];
export function mapFilter<T, U>(
  array: readonly T[],
  mapper: (element: T) => U,
  filter: (element: U) => boolean
): U[];
export function mapFilter<T, U>(
  array: readonly T[],
  mapper: (element: T) => U,
  filter: (element: U) => boolean
): U[] {
  const result: U[] = [];

  for (const element of array) {
    const mapped = mapper(element);

    if (filter(mapped)) {
      result.push(mapped);
    }
  }

  return result;
}

/**
 * Splits an array into two groups, the first containing all elements which
 * were truthy when evaluated for the given projection function, and the second
 * containing all other elements.
 *
 * Example: Partitioning a list into odd and even numbers
 *
 * partition([1, 2, 3, 4], val => val % 2 !== 0) => [[1, 3], [2, 4]]
 *
 * @param collection An array.
 * @param projection A function to be called for each item in the collection.
 * @returns A two-item array, the first containing a list of truthy values, and
 *          the second containing a list of falsey values.
 */
export function partition<T>(
  collection: readonly T[],
  projection: (value: T) => boolean
): [readonly T[], readonly T[]] {
  const matching: T[] = [];
  const nonMatching: T[] = [];

  collection.forEach((item) => {
    if (projection(item)) {
      matching.push(item);
    } else {
      nonMatching.push(item);
    }
  });

  return [matching, nonMatching];
}

// All the distinct elements in as that is not in bs
export function setDiff<T>(as: readonly T[], bs: readonly T[]): readonly T[] {
  const setAs = new Set(as);
  const setBs = new Set(bs);
  return Array.from(setAs).filter((a) => !setBs.has(a));
}

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] // eslint-disable-line local-rules/readonly-array
    ? RecursivePartial<U>[] // eslint-disable-line local-rules/readonly-array
    : RecursivePartial<T[P]>;
};

/**
 * Converts a value into a number, provided it is a number or string.
 * Otherwise, convert it to undefined.
 *
 * For general use, but especially for transformer functions where the backend
 * type for "empty/falsey" values should be universally turned into `undefined`
 * to be consumed by the application.
 */
export function toNumber(value: string | number): number;
export function toNumber(
  value: string | number | null | undefined | false
): number | undefined;
export function toNumber(
  value: string | number | null | undefined | false
): number | undefined {
  // check type OR truthiness to avoid 0 issues
  return typeof value === 'number' || value ? Number(value) : undefined;
}

/**
 * Deeply merges two objects to create a new object, where the second object
 * does not need to have all properties of the first.
 */
export function deepSpread<T>(original: T, delta: RecursivePartial<T>): T {
  if (!isObject(delta)) {
    return delta;
  }

  return {
    ...original,
    ...mapValues<any, keyof T>(delta, (value, key) =>
      deepSpread(((original || {}) as any)[key], value)
    ),
  };
}

export const generateId = (() => {
  let id = 0;
  let index = 0;

  return () => {
    id += Math.ceil(random(index++, 'ids') * 1000);
    if (id > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Ran out of ids, they have gone above the max safe integer ${Number.MAX_SAFE_INTEGER}`
      );
    }
    return id;
  };
})();

/**
 * A highly-pseudo seedable, random number generator
 * Based on code from https://stackoverflow.com/a/19303725
 *
 * This function should probably not be exported, and instead
 * developers should prefer functions such as `randomiseList`.
 */
function random(index: number, seed: string): number {
  const x = Math.sin(index + 1 + hashCode(seed)) * 10_000;
  return x - Math.floor(x);
}

export function randomiseList<T>(
  list: readonly T[],
  seed: string
): readonly T[] {
  return list
    .map((value, index) => [value, random(index, seed)] as const)
    .sort(([, a], [, b]) => b - a)
    .map(([a]) => a);
}

/* eslint-disable no-bitwise */
/* Based on https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

export function generateNumbersInRange(
  min: number,
  max: number,
  count: number
): readonly number[] {
  return count === 1
    ? [min]
    : Array.from(
        { length: count },
        (v, i) => min + ((i % count) * (max - min)) / (count - 1)
      );
}

export function generateIntegersInRange(
  min: number,
  max: number,
  count: number
): readonly number[] {
  if (max - min + 1 < count) {
    throw new Error(
      `Cannot generate ${count} integers between ${min} and ${max}.`
    );
  }
  return generateNumbersInRange(min, max, count).map((x) => Math.floor(x));
}
