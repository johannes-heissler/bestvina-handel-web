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
 * **Holes.** For a piece of a reduction, G is a subsurface: a face of G whose word reduces to a reduction curve (not to
 * a boundary word of the target) is a hole, where the rest of the surface was cut away, and it crosses the target edges
 * between strands. Its surviving letters are the strands next to it, so they end one chain along the edge and start
 * the next; the chains are joined from the outermost strand on the right to the one on the left.
 *
 * Cancelling pairs are found with a stack, which pairs ℓ with the ℓ̄ after a subword that reduces to nothing: the
 * part of F's boundary around a disk. Two different choices can't both be geometric (a strand side bounds only one
 * gap), so for a map that comes from an embedding the pairing is the right one.
 *
 * @module
 */
import type { CombinatorialMap } from "../graph/combinatorial-map";
import type { EdgePath } from "../graph/edge-path";
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

/** One letter of a concatenated boundary word: which strand's side it is, and the letter of the word it comes from. */
interface Side {
  readonly letter: OrientedEdge;
  readonly strand: Strand;
  readonly from: number;
}

/**
 * The order of the strands of `map` along each target edge.
 *
 * **Hairpins.** A junction of valence 2 whose two strips leave through the same side (e.g. while an isotopy moves it
 * across a side: it sits just beyond the side, and both strips cross it next to each other) makes both of its corners
 * read a cancelling pair ℓ ℓ̄ in the boundary words, but only the corner inside the hairpin lies in the gap between the
 * two strands; the face at the other corner wraps around the tip of the hairpin, and its two letters belong to gaps
 * with other strands. Which corner is inside is not visible in the ribbon structure (both corners of a junction of
 * valence 2 look alike). So if the strands don't form chains, the cancellation at one corner of each such junction is
 * forbidden (the reduction then pairs those letters with others), trying the choices until they do.
 *
 * @throws Error if the relations don't form one chain per target edge, i.e. the map doesn't come from an embedding
 *   (it doesn't preserve boundary words, or the ribbon structures don't match).
 */
export function strandOrder(map: CombinatorialMap, holes: readonly EdgePath[] = []): StrandOrder {
  const count = new Map<Edge, number>();
  for (const e of map.source.edges)
    for (const letter of map.image(e.forward).letters)
      count.set(letter.edge, (count.get(letter.edge) ?? 0) + 1);

  /** The strand of a side, with its direction along the target edge. */
  const placed = (side: Side): PlacedStrand => ({
    strand: side.strand,
    forward: isForwardInImage(map, side.strand),
  });

  // The boundary words as sequences of sides, and the hairpin corners in them: the positions (i, i + 1) of the last
  // side before and the first side after a junction of valence 2, whose letters cancel.
  const words = map.source.boundaryWords().map((word) => {
    const letters = word.letters;
    const sides: Side[] = letters.flatMap((x, from) => {
      const image = map.image(x).letters;
      return image.map((letter, k) => ({
        letter,
        strand: { edge: x.edge, index: x.isForward ? k : image.length - 1 - k },
        from,
      }));
    });
    return { letters, sides };
  });
  const corners = new Map<string, string[]>(); // junction → its hairpin corners, as "word:i:j"
  words.forEach(({ letters, sides }, w) => {
    sides.forEach((side, i) => {
      const j = (i + 1) % sides.length;
      const next = sides[j] as Side;
      if (next.from === side.from || next.letter !== side.letter.reversed) return;
      const v = (letters[side.from] as OrientedEdge).target;
      if (map.source.valence(v) !== 2) return;
      const key = String(v.id);
      corners.set(key, [...(corners.get(key) ?? []), `${w}:${i}:${j}`]);
    });
  });

  const holeWords = new Set(
    holes
      .flatMap((curve) => [curve, curve.inverse])
      .map((curve) => cyclicKey(curve.cyclicallyReduced().letters)),
  );

  const attempt = (forbidden: ReadonlySet<string>): StrandOrder => {
    // leftOf.get(A) = the strand immediately left of A, along A's target edge (forward orientation).
    const leftOf = new Map<string, PlacedStrand>();
    const rightmost = new Map<Edge, PlacedStrand>();
    const leftmost = new Map<Edge, PlacedStrand>();
    // Next to a hole (see below): the strands with the hole immediately on their left, and on their right.
    const holeOnLeft = new Map<Edge, PlacedStrand[]>();
    const holeOnRight = new Map<Edge, PlacedStrand[]>();
    words.forEach(({ sides }, w) => {
      const { pairs, survivors } = cyclicReduction(
        sides.map((side) => side.letter),
        (i, j) => forbidden.has(`${w}:${i}:${j}`),
      );
      for (const [i, j] of pairs) {
        const [a, b] = [sides[i] as Side, sides[j] as Side]; // a's letter ℓ comes before b's ℓ̄
        const [left, right] = a.letter.isForward ? [a, b] : [b, a]; // along the edge's forward orientation
        set(leftOf, strandKey(right.strand), placed(left), "left neighbour");
      }
      // A face whose reduced image is one of the `holes` (a reduction curve) is a hole: the map is the embedding of a
      // subsurface (a piece after a reduction), and the face is where the rest of the surface was cut away. Its
      // surviving letters are strands next to that hole, which crosses the target edge between strands.
      const hole =
        holeWords.size > 0 && holeWords.has(cyclicKey(survivors.map((i) => (sides[i] as Side).letter)));
      for (const i of survivors) {
        const side = sides[i] as Side;
        const edge = side.letter.edge;
        // The face is on the right of the letter: along the edge's forward orientation, on the right of the strand if
        // the letter is forward, else on its left.
        if (!hole) set(side.letter.isForward ? rightmost : leftmost, edge, placed(side), "outermost strand");
        else {
          const list = side.letter.isForward ? holeOnRight : holeOnLeft;
          list.set(edge, [...(list.get(edge) ?? []), placed(side)]);
        }
      }
    });

    const along = new Map<Edge, PlacedStrand[]>();
    const position = new Map<string, number>();
    for (const [edge, n] of count) {
      // The chains from right to left: from the rightmost strand, or from a strand with a hole on its right, to the
      // leftmost one or one with a hole on its left. Without holes, one chain.
      const starts = [
        ...(rightmost.has(edge) ? [rightmost.get(edge) as PlacedStrand] : []),
        ...(holeOnRight.get(edge) ?? []),
      ];
      const ends = new Set(
        [
          ...(holeOnLeft.get(edge) ?? []),
          ...(leftmost.has(edge) ? [leftmost.get(edge) as PlacedStrand] : []),
        ].map((s) => strandKey(s.strand)),
      );
      const chains = starts.map((start) => {
        const chain: PlacedStrand[] = [];
        for (
          let side: PlacedStrand | undefined = start;
          side !== undefined && chain.length <= n;
          side = ends.has(strandKey(side.strand)) ? undefined : leftOf.get(strandKey(side.strand))
        )
          chain.push(side);
        return chain;
      });
      // The chain from the rightmost strand first and the one to the leftmost strand last; the chains between holes in
      // the order found (with one hole crossing the edge, there is none).
      const lastKey = leftmost.has(edge) ? strandKey((leftmost.get(edge) as PlacedStrand).strand) : undefined;
      const [first, ...middle] = chains;
      const final = middle.findIndex(
        (c) => c.length > 0 && strandKey((c.at(-1) as PlacedStrand).strand) === lastKey,
      );
      const ordered = rightmost.has(edge)
        ? [
            first ?? [],
            ...middle.filter((_, i) => i !== final),
            ...(final >= 0 ? [middle[final] as PlacedStrand[]] : []),
          ]
        : chains;
      const chain = ordered.flat();
      const lastOfChain = chain.at(-1);
      if (
        chain.length !== n ||
        new Set(chain.map((s) => strandKey(s.strand))).size !== n ||
        (lastKey !== undefined && (lastOfChain === undefined || strandKey(lastOfChain.strand) !== lastKey)) ||
        rightmost.has(edge) !== leftmost.has(edge)
      )
        throw new Error(
          `The strands along ${edge} don't form one chain: the map doesn't come from an embedding`,
        );
      chain.forEach((side, i) => position.set(strandKey(side.strand), i));
      along.set(edge, chain);
    }
    return { along, position };
  };

  // First as they are; then, for the junctions with two hairpin corners, forbid one of them (at most 2⁸ choices).
  const junctions = [...corners.values()].filter((list) => list.length > 1);
  const choices = Math.min(2 ** junctions.length, 256);
  let failure: unknown;
  for (let choice = -1; choice < (junctions.length > 0 ? choices : 0); choice++) {
    try {
      return attempt(
        new Set(choice < 0 ? [] : junctions.map((list, k) => list[(choice >> k) & 1] as string)),
      );
    } catch (e) {
      failure = e;
    }
  }
  throw failure;
}

/** A key of a cyclic word, the same for all its rotations. */
function cyclicKey(letters: readonly OrientedEdge[]): string {
  const keys = letters.map((x) => `${x.edge.id}${x.isForward ? "+" : "-"}`);
  let best = keys.join(" ");
  for (let i = 1; i < keys.length; i++) {
    const rotated = [...keys.slice(i), ...keys.slice(0, i)].join(" ");
    if (rotated < best) best = rotated;
  }
  return best;
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
 * across the end have i near the end and j near the start), and the positions of the surviving letters. The letters
 * at positions i, j for which `forbidden(i, j)` holds are not cancelled with each other.
 */
export function cyclicReduction(
  word: readonly OrientedEdge[],
  forbidden: (i: number, j: number) => boolean = () => false,
): {
  pairs: [number, number][];
  survivors: number[];
} {
  const stack: number[] = [];
  const pairs: [number, number][] = [];
  word.forEach((letter, j) => {
    const top = stack.at(-1);
    if (top !== undefined && word[top] === letter.reversed && !forbidden(top, j)) {
      stack.pop();
      pairs.push([top, j]);
    } else stack.push(j);
  });
  let [first, last] = [0, stack.length - 1];
  while (
    last > first &&
    word[stack[last] as number] === (word[stack[first] as number] as OrientedEdge).reversed &&
    !forbidden(stack[last] as number, stack[first] as number)
  ) {
    pairs.push([stack[last] as number, stack[first] as number]); // ℓ near the end, ℓ̄ at the start
    first++;
    last--;
  }
  return { pairs, survivors: stack.slice(first, last + 1) };
}
