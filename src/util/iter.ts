/**
 * Iteration helpers that are not built into arrays or ES2025 iterators.
 *
 * Most LINQ methods have direct built-in counterparts (see docs/porting-guide.md); only the rest lives
 * here. Functions take `Iterable`s where one pass suffices and `readonly` arrays where they need
 * random access or several passes.
 *
 * @module
 */
import { mod } from "./number";

/** The result of {@link argMin} / {@link argMax}. */
export interface Extremum<T> {
  readonly item: T;
  readonly index: number;
  readonly value: number;
}

/**
 * The first element with the smallest `key`, together with its index and key value.
 * Returns `undefined` for an empty input. Elements whose key is `NaN` are never chosen.
 */
export function argMin<T>(items: Iterable<T>, key: (item: T) => number): Extremum<T> | undefined {
  let best: Extremum<T> | undefined;
  let index = 0;
  for (const item of items) {
    const value = key(item);
    if (best === undefined ? !Number.isNaN(value) : value < best.value) best = { item, index, value };
    index++;
  }
  return best;
}

/** The first element with the largest `key`; see {@link argMin}. */
export function argMax<T>(items: Iterable<T>, key: (item: T) => number): Extremum<T> | undefined {
  const result = argMin(items, (item) => -key(item));
  return result && { ...result, value: -result.value };
}

/** `0, 1, …, n - 1`. */
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Cyclic rotation that starts at index `start` (taken modulo the length):
 * `rotate([a, b, c], 1)` is `[b, c, a]`, and so is `rotate([a, b, c], -2)`.
 */
export function rotate<T>(items: readonly T[], start: number): T[] {
  if (items.length === 0) return [];
  const k = mod(start, items.length);
  return [...items.slice(k), ...items.slice(0, k)];
}

/**
 * Cyclic rotation that starts at the first element satisfying `isFirst`.
 * Returns an unchanged copy if no element does.
 */
export function rotateTo<T>(items: readonly T[], isFirst: (item: T) => boolean): T[] {
  const k = items.findIndex(isFirst);
  return k === -1 ? [...items] : rotate(items, k);
}

/** Repeats `items` forever. Combine with `.take(n)` to get `n` elements. */
export function* cycle<T>(items: readonly T[]): Generator<T, void, undefined> {
  if (items.length === 0) return;
  for (;;) yield* items;
}

/** All pairs `[a, b]` with `a` from `first` and `b` from `second`, in lexicographic order. */
export function* cartesianProduct<A, B>(
  first: Iterable<A>,
  second: readonly B[],
): Generator<[A, B], void, undefined> {
  for (const a of first) for (const b of second) yield [a, b];
}

/**
 * The first element whose key already occurred earlier, or `undefined` if all keys are distinct.
 * Keys are compared with `SameValueZero`, as in a `Set`, so object keys are compared by reference.
 */
export function firstDuplicate<T, K = T>(
  items: Iterable<T>,
  key: (item: T) => K = (item) => item as unknown as K,
): T | undefined {
  const seen = new Set<K>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) return item;
    seen.add(k);
  }
  return undefined;
}

/** Equality used by the prefix functions; defaults to `===`. */
export type Equality<T> = (a: T, b: T) => boolean;

const strictEquals = <T>(a: T, b: T): boolean => a === b;

/** The length of the longest common prefix of `a` and `b`. */
export function sharedPrefixLength<T>(
  a: Iterable<T>,
  b: Iterable<T>,
  equals: Equality<T> = strictEquals,
): number {
  const other = b[Symbol.iterator]();
  let length = 0;
  for (const x of a) {
    const next = other.next();
    if (next.done || !equals(x, next.value)) break;
    length++;
  }
  return length;
}

/**
 * The longest common prefix of all `lists`.
 *
 * @throws RangeError if `lists` is empty: the common prefix of no lists is undefined.
 */
export function sharedPrefix<T>(lists: readonly (readonly T[])[], equals: Equality<T> = strictEquals): T[] {
  const [first, ...rest] = lists;
  if (first === undefined) throw new RangeError("sharedPrefix of an empty list of lists");
  let length = first.length;
  for (const list of rest)
    length = Math.min(length, sharedPrefixLength(first.slice(0, length), list, equals));
  return first.slice(0, length);
}
