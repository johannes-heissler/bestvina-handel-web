/**
 * The order of strands along the edges of the target of a combinatorial map (design doc § 3, step 1).
 *
 * For μ : G → G₀, every letter of μ(e) is a strand of e running along an edge of G₀ (for a polygon model: crossing a
 * side). For g : G → G, the strands are the pieces of the image f(F) inside the strips of F (the striped view).
 *
 * **The algorithm (port note 20).** Take a boundary word b₁ ⋯ bₘ of the source (a face F, on the right of each bᵢ)
 * and concatenate the images: W_F = map(b₁) ⋯ map(bₘ). Each letter ℓ of W_F is one side of one strand, with F
 * immediately on its right (in the direction of ℓ). Cyclically reducing W_F gives a boundary word of the target
 * (since the map preserves boundary words). Then:
 *
 * - two letters ℓ, ℓ̄ that **cancel** are the two sides of a gap of F between two **adjacent** strands along ℓ: the
 *   strand of ℓ is immediately left of the strand of ℓ̄ (F lies between them);
 * - a letter ℓ that **survives** is the outermost strand on the right of ℓ (next to the target face).
 *
 * Since each side of each strand faces exactly one face, one pass over all boundary words gives every "immediate
 * neighbour" relation, and the order along each target edge is the chain of these relations.
 *
 * Cancelling pairs are found with a stack, which pairs ℓ with the ℓ̄ after a subword that reduces to nothing: the
 * part of F's boundary around a disk. Two different choices can't both be geometric (a strand side bounds only one
 * gap), so for a map that comes from an embedding the pairing is the right one.
 *
 * @module
 */
import type { CombinatorialMap } from "../graph/combinatorial-map";
import type { Edge, OrientedEdge } from "../graph/ribbon-graph";

/** A strand: the letter `index` of the image of the forward orientation of `edge`. */
export interface Strand {
  readonly edge: Edge;
  readonly index: number;
}

/** A strand along a target edge, and whether it runs along the edge's forward orientation. */
export interface PlacedStrand {
  readonly strand: Strand;
  readonly forward: boolean;
}

export interface StrandOrder {
  /**
   * For each target edge, its strands **from right to left** as seen along the edge's forward orientation (so for a
   * polygon side crossed outwards, in counterclockwise order along the side).
   */
  readonly along: ReadonlyMap<Edge, readonly PlacedStrand[]>;
  /** The position of each strand in its edge's list, keyed by {@link strandKey}. */
  readonly position: ReadonlyMap<string, number>;
}

/** A key for a strand, for maps and sets. */
export function strandKey(strand: Strand): string {
  return `${strand.edge.id}:${strand.index}`;
}

/** One letter of a concatenated boundary word: which strand's side it is. */
interface Side {
  readonly letter: OrientedEdge;
  readonly strand: Strand;
}

/**
 * The order of the strands of `map` along each target edge.
 *
 * @throws Error if the relations don't form one chain per target edge, i.e. the map doesn't come from an embedding
 *   (it doesn't preserve boundary words, or the ribbon structures don't match).
 */
export function strandOrder(map: CombinatorialMap): StrandOrder {
  // leftOf.get(A) = the strand immediately left of A, along A's target edge (forward orientation).
  const leftOf = new Map<string, PlacedStrand>();
  const rightmost = new Map<Edge, PlacedStrand>();
  const leftmost = new Map<Edge, PlacedStrand>();
  const count = new Map<Edge, number>();

  for (const e of map.source.edges)
    for (const letter of map.image(e.forward).letters)
      count.set(letter.edge, (count.get(letter.edge) ?? 0) + 1);

  /** The strand of a side, with its direction along the target edge. */
  const placed = (s: Side): PlacedStrand => ({ strand: s.strand, forward: isForwardInImage(map, s.strand) });
  /** Records that the strand of `a` is immediately left of that of `b` in the direction of `a`'s letter. */
  const adjacent = (a: Side, b: Side) => {
    const [left, right] = a.letter.isForward ? [a, b] : [b, a]; // along the edge's forward orientation
    set(leftOf, strandKey(right.strand), placed(left), "left neighbour");
  };

  for (const word of map.source.boundaryWords()) {
    const sides: Side[] = word.letters.flatMap((x) => {
      const letters = map.image(x).letters;
      return letters.map((letter, k) => ({
        letter,
        strand: { edge: x.edge, index: x.isForward ? k : letters.length - 1 - k },
      }));
    });
    const { pairs, survivors } = cyclicReduction(sides.map((s) => s.letter));
    for (const [i, j] of pairs) {
      const [a, b] = [sides[i] as Side, sides[j] as Side]; // a's letter ℓ comes before b's ℓ̄
      adjacent(a, b);
    }
    for (const i of survivors) {
      const s = sides[i] as Side;
      // The target face is on the right of s's letter: s is the rightmost along the letter's direction.
      set(s.letter.isForward ? rightmost : leftmost, s.letter.edge, placed(s), "outermost strand");
    }
  }

  const along = new Map<Edge, PlacedStrand[]>();
  const position = new Map<string, number>();
  for (const [edge, n] of count) {
    const chain: PlacedStrand[] = [];
    for (
      let s = rightmost.get(edge);
      s !== undefined && chain.length <= n;
      s = leftOf.get(strandKey(s.strand))
    )
      chain.push(s);
    const last = chain.at(-1);
    const expectedLast = leftmost.get(edge);
    if (
      chain.length !== n ||
      last === undefined ||
      expectedLast === undefined ||
      strandKey(last.strand) !== strandKey(expectedLast.strand)
    )
      throw new Error(
        `The strands along ${edge} don't form one chain: the map doesn't come from an embedding`,
      );
    chain.forEach((s, i) => position.set(strandKey(s.strand), i));
    along.set(edge, chain);
  }
  return { along, position };
}

/** Whether the strand's letter in the image of its edge's forward orientation is a forward letter of the target. */
function isForwardInImage(map: CombinatorialMap, strand: Strand): boolean {
  return (map.image(strand.edge.forward).letters[strand.index] as OrientedEdge).isForward;
}

function set<K, V>(map: Map<K, V>, key: K, value: V, what: string): void {
  if (map.has(key))
    throw new Error(
      `Two candidates for the ${what} of ${String(key)}: the map doesn't come from an embedding`,
    );
  map.set(key, value);
}

/**
 * The cyclic reduction of a word, with the cancelling pairs (i, j), i before j (cyclically: the pairs cancelled
 * across the end have i near the end and j near the start), and the positions of the surviving letters.
 */
export function cyclicReduction(word: readonly OrientedEdge[]): {
  pairs: [number, number][];
  survivors: number[];
} {
  const stack: number[] = [];
  const pairs: [number, number][] = [];
  word.forEach((letter, j) => {
    const top = stack.at(-1);
    if (top !== undefined && word[top] === letter.reversed) {
      stack.pop();
      pairs.push([top, j]);
    } else stack.push(j);
  });
  let [first, last] = [0, stack.length - 1];
  while (
    last > first &&
    word[stack[last] as number] === (word[stack[first] as number] as OrientedEdge).reversed
  ) {
    pairs.push([stack[last] as number, stack[first] as number]); // ℓ near the end, ℓ̄ at the start
    first++;
    last--;
  }
  return { pairs, survivors: stack.slice(first, last + 1) };
}
