/**
 * Words in a free group, i.e. edge paths up to the choice of letters.
 *
 * A word is an array of letters. Each letter has a formal inverse, given by a function `inverse`
 * (for oriented edges of a graph: the same edge with the opposite orientation). Letters are compared
 * with `===`, so every letter and its inverse must be unique objects (or primitives). Oriented strips
 * satisfy this, because a strip caches its reversed strip.
 *
 * The same functions serve the carrying map g (words in the edges of G) and the inverse marking μ (words
 * in the edges of G₀); see docs/design/embedding.md.
 *
 * @module
 */

/** The formal inverse of a letter. Must be an involution: `inverse(inverse(x)) === x`. */
export type Inverse<L> = (letter: L) => L;

/** The inverse word: the reversed sequence of inverse letters, (x₁ ⋯ xₙ)⁻¹ = xₙ⁻¹ ⋯ x₁⁻¹. */
export function invertWord<L>(word: readonly L[], inverse: Inverse<L>): L[] {
  return word.toReversed().map(inverse);
}

/**
 * How many letters cancel when concatenating `u` and `v`: the largest k such that the last k letters of
 * `u` are the inverse of the first k letters of `v`. Cancellation inside `u` or `v` is not considered.
 */
export function cancellationLength<L>(u: readonly L[], v: readonly L[], inverse: Inverse<L>): number {
  let k = 0;
  while (k < u.length && k < v.length && u[u.length - 1 - k] === inverse(v[k] as L)) k++;
  return k;
}

/**
 * The concatenation u · v, cancelling at the junction. If `u` and `v` are reduced, the result is reduced.
 * Also returns the number of cancelled letter pairs.
 */
export function concatReduced<L>(
  u: readonly L[],
  v: readonly L[],
  inverse: Inverse<L>,
): { word: L[]; cancelled: number } {
  const k = cancellationLength(u, v, inverse);
  return { word: [...u.slice(0, u.length - k), ...v.slice(k)], cancelled: k };
}

/** Free reduction: removes all adjacent pairs x x⁻¹, repeatedly (a single pass with a stack). */
export function reduceWord<L>(word: Iterable<L>, inverse: Inverse<L>): L[] {
  const stack: L[] = [];
  for (const letter of word) {
    if (stack.length > 0 && stack[stack.length - 1] === inverse(letter)) stack.pop();
    else stack.push(letter);
  }
  return stack;
}

/** Whether the word contains no adjacent pair x x⁻¹. */
export function isReduced<L>(word: readonly L[], inverse: Inverse<L>): boolean {
  for (let i = 0; i + 1 < word.length; i++) if (word[i + 1] === inverse(word[i] as L)) return false;
  return true;
}
