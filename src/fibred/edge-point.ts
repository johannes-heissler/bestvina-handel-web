/**
 * Points of strips that g maps to junctions (the C# `EdgePoint`).
 *
 * @module
 */
import type { OrientedEdge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";
import type { Text, TextPart } from "./suggestions";

/**
 * The point of the strip `edge` that g maps to the junction between the letters `index − 1` and `index` of
 * g(edge). Index 0 is the start of the strip, index |g(edge)| its end.
 *
 * An edge point refers to the current g: it becomes meaningless when g(edge) changes. The moves that need
 * to follow a point (removing inefficiencies) transform it explicitly.
 */
export class EdgePoint {
  constructor(
    readonly edge: OrientedEdge,
    readonly index: number,
  ) {}

  /** The same point, described from the other end of the strip. */
  reversed(fs: FibredSurface): EdgePoint {
    return new EdgePoint(this.edge.reversed, fs.g.image(this.edge).length - this.index);
  }

  /** The same point, described along the forward orientation of the strip. */
  normalized(fs: FibredSurface): EdgePoint {
    return this.edge.isForward ? this : this.reversed(fs);
  }

  /** Whether both describe the same point of the same strip (possibly from different ends). */
  equals(other: EdgePoint, fs: FibredSurface): boolean {
    const [p, q] = [this.normalized(fs), other.normalized(fs)];
    return p.edge === q.edge && p.index === q.index;
  }

  /** The junction at this point, if it is an end of the strip. */
  vertex(fs: FibredSurface): Vertex | undefined {
    if (this.index === 0) return this.edge.source;
    if (this.index === fs.g.image(this.edge).length) return this.edge.target;
    return undefined;
  }

  /** The junction that g maps this point to. */
  image(fs: FibredSurface): Vertex {
    const image = fs.g.image(this.edge);
    const next = image.at(this.index);
    return next !== undefined
      ? next.source
      : ((image.last?.target ?? fs.g.vertexImage(this.edge.source)) as Vertex);
  }

  /**
   * The direction in which g leaves the image junction backwards: the inverse of the letter before the point.
   * At the start of the strip, this is Dg of the other strip end at a valence-2 junction (and undefined at
   * other junctions), as in the C# `DgBefore`.
   */
  dgBefore(fs: FibredSurface): OrientedEdge | undefined {
    if (this.index > 0) return fs.g.image(this.edge).at(this.index - 1)?.reversed;
    const star = fs.graph.star(this.edge.source);
    if (star.length !== 2) return undefined;
    const other = star[0] === this.edge ? star[1] : star[0];
    return other === undefined ? undefined : fs.g.derivative(other);
  }

  /** The direction in which g leaves the image junction forwards; see {@link dgBefore}. */
  dgAfter(fs: FibredSurface): OrientedEdge | undefined {
    return this.reversed(fs).dgBefore(fs);
  }

  /**
   * The path of strips through this point, split at it: the strip itself, or at a junction of valence 2 the two
   * strips through it (the path x y through the junction between them).
   */
  private split(fs: FibredSurface): { path: OrientedEdge[]; before: OrientedEdge[]; after: OrientedEdge[] } {
    const letters = fs.g.image(this.edge).letters;
    const v = this.vertex(fs);
    if (v !== undefined && fs.graph.valence(v) === 2) {
      const [x, y] =
        this.index === 0
          ? [this.otherEnd(fs, this.edge).reversed, this.edge]
          : [this.edge, this.otherEnd(fs, this.edge.reversed)];
      return { path: [x, y], before: [...fs.g.image(x).letters], after: [...fs.g.image(y).letters] };
    }
    return { path: [this.edge], before: letters.slice(0, this.index), after: letters.slice(this.index) };
  }

  /** The other strip end at the (valence-2) source of `e`. */
  private otherEnd(fs: FibredSurface, e: OrientedEdge): OrientedEdge {
    const star = fs.graph.star(e.source);
    return (star[0] === e ? star[1] : star[0]) as OrientedEdge;
  }

  /** The same as {@link describe}, as structured text (the strips in their colours). */
  describeText(fs: FibredSurface): Text {
    const names = (xs: readonly OrientedEdge[]): TextPart[] =>
      xs.flatMap((x, i) => [...(i === 0 ? [] : [" "]), { strip: x.name }]);
    const { path, before, after } = this.split(fs);
    return ["g(", ...names(path), ") = ", ...names(before), " | ", ...names(after)];
  }

  /** E.g. "g(a) = b C|a B", or at a junction of valence 2 between the strips a and b, "g(a b) = b C|a B". */
  describe(fs: FibredSurface): string {
    const names = (xs: readonly OrientedEdge[]) => xs.map((e) => e.name).join(" ");
    const { path, before, after } = this.split(fs);
    return `g(${names(path)}) = ${names(before)}|${names(after)}`;
  }
}
