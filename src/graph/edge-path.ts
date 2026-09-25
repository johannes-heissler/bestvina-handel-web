/**
 * Edge paths: finite sequences of oriented edges of a ribbon graph. Replaces the C# `EdgePath` tree
 * (`NormalEdgePath`, `NestedEdgePath`, `NamedEdgePath`, `ConjugateEdgePath`): the port keeps only the flat
 * letter sequence; named paths and conjugations exist only in the text input (port note 06, decision C2).
 *
 * @module
 */
import { cancellationLength, isReduced, reduceWord } from "../util/words";
import type { Edge, OrientedEdge, Vertex } from "./ribbon-graph";

const reverse = (e: OrientedEdge) => e.reversed;

/**
 * An immutable edge path e₁ e₂ ⋯ eₙ. It is not required to be continuous (t(eᵢ) = o(eᵢ₊₁)); use
 * {@link EdgePath.isContinuous} to check. The empty path has no source or target.
 */
export class EdgePath implements Iterable<OrientedEdge> {
  static readonly EMPTY = new EdgePath([]);

  private cachedInverse: EdgePath | undefined;

  private constructor(readonly letters: readonly OrientedEdge[]) {}

  /** The path with the given letters. */
  static of(...letters: OrientedEdge[]): EdgePath {
    return EdgePath.from(letters);
  }

  /** The path with the letters of `letters` (copied). */
  static from(letters: Iterable<OrientedEdge>): EdgePath {
    const array = [...letters];
    return array.length === 0 ? EdgePath.EMPTY : new EdgePath(array);
  }

  /** The concatenation of `paths`, without cancellation. */
  static concatAll(paths: Iterable<EdgePath>): EdgePath {
    return EdgePath.from([...paths].flatMap((p) => p.letters));
  }

  [Symbol.iterator](): Iterator<OrientedEdge> {
    return this.letters[Symbol.iterator]();
  }

  get length(): number {
    return this.letters.length;
  }

  get isEmpty(): boolean {
    return this.letters.length === 0;
  }

  /** The i-th letter (negative i counts from the end), or `undefined` if out of range. */
  at(i: number): OrientedEdge | undefined {
    return this.letters.at(i);
  }

  get first(): OrientedEdge | undefined {
    return this.letters[0];
  }

  get last(): OrientedEdge | undefined {
    return this.letters.at(-1);
  }

  /** o(e₁), or `undefined` for the empty path. */
  get source(): Vertex | undefined {
    return this.first?.source;
  }

  /** t(eₙ), or `undefined` for the empty path. */
  get target(): Vertex | undefined {
    return this.last?.target;
  }

  /** The inverse path ēₙ ⋯ ē₁ (cached). */
  get inverse(): EdgePath {
    if (this.cachedInverse === undefined) {
      this.cachedInverse = new EdgePath(this.letters.toReversed().map(reverse));
      this.cachedInverse.cachedInverse = this;
    }
    return this.cachedInverse;
  }

  /** The concatenation with `others`, without cancellation. */
  concat(...others: EdgePath[]): EdgePath {
    return EdgePath.concatAll([this, ...others]);
  }

  /**
   * The concatenation with `other`, cancelling at the junction (and only there): if both paths are
   * reduced, so is the result. Also returns the number of cancelled pairs.
   */
  concatReduced(other: EdgePath): { path: EdgePath; cancelled: number } {
    const k = cancellationLength(this.letters, other.letters, reverse);
    return {
      path: EdgePath.from([...this.letters.slice(0, this.length - k), ...other.letters.slice(k)]),
      cancelled: k,
    };
  }

  /** The letters from `start` (inclusive) to `end` (exclusive); replaces the C# `Skip` and `Take`. */
  slice(start: number, end?: number): EdgePath {
    return EdgePath.from(this.letters.slice(start, end));
  }

  /** Whether the path has no backtracking e ē. */
  get isReduced(): boolean {
    return isReduced(this.letters, reverse);
  }

  /** The path with all backtracking removed (pulled tight relative to its endpoints). */
  reduced(): EdgePath {
    return this.isReduced ? this : EdgePath.from(reduceWord(this.letters, reverse));
  }

  /**
   * The reduced path, with additionally the first and last letters cancelled against each other as long as
   * they are inverse: the tight representative of a closed path up to free homotopy (the C#
   * `CancelBacktracking(cyclic: true)`).
   */
  cyclicallyReduced(): EdgePath {
    const letters = reduceWord(this.letters, reverse);
    let start = 0;
    let end = letters.length;
    while (end - start > 1 && letters[end - 1] === (letters[start] as OrientedEdge).reversed) {
      start++;
      end--;
    }
    return EdgePath.from(letters.slice(start, end));
  }

  /** Whether consecutive letters fit together: t(eᵢ) = o(eᵢ₊₁). The empty path is continuous. */
  get isContinuous(): boolean {
    return this.letters.every((e, i) => i === 0 || (this.letters[i - 1] as OrientedEdge).target === e.source);
  }

  /** Whether the path is continuous, non-empty and ends where it starts. */
  get isClosed(): boolean {
    return !this.isEmpty && this.isContinuous && this.source === this.target;
  }

  /**
   * Replaces every letter by a path: the forward orientation of an edge e by `image(e)`, the backward
   * orientation by the inverse of `image(e)`. This is how an edge path is mapped by a combinatorial map, and
   * how images change when the target graph changes (the C# `Replace`).
   */
  substitute(image: (edge: Edge) => EdgePath): EdgePath {
    return EdgePath.concatAll(this.letters.map((e) => (e.isForward ? image(e.edge) : image(e.edge).inverse)));
  }

  /** How often the edge `edge` occurs, in either orientation. */
  count(edge: Edge): number {
    return this.letters.reduce((n, e) => (e.edge === edge ? n + 1 : n), 0);
  }

  /** Whether both paths have the same letters. */
  equals(other: EdgePath): boolean {
    return this.length === other.length && this.letters.every((e, i) => e === other.letters[i]);
  }

  /**
   * Whether `other` is a cyclic rotation of this path (as closed paths, up to the choice of start).
   * The empty path is only a rotation of itself.
   */
  isRotationOf(other: EdgePath): boolean {
    if (this.length !== other.length) return false;
    if (this.isEmpty) return true;
    const n = this.length;
    return this.letters.some((_, shift) =>
      this.letters.every((e, i) => e === other.letters[(i + shift) % n]),
    );
  }

  /**
   * A string that identifies the letters, for use as a `Map`/`Set` key: two paths in the same graph have
   * the same key iff they are equal. (Edge ids are only unique within one graph.)
   */
  get key(): string {
    return this.letters.map((e) => (e.isForward ? e.edge.id : -1 - e.edge.id)).join(",");
  }

  /** The letter names separated by spaces, e.g. "a B c"; the empty path is "". */
  toString(): string {
    return this.letters.map((e) => e.name).join(" ");
  }
}
