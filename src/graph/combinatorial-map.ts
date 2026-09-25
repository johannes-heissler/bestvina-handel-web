/**
 * Combinatorial maps between ribbon graphs: the carrying map g : G → G and the inverse marking μ : G → G₀
 * (see docs/design/embedding.md). Replaces `Strip.EdgePath`, `Junction.image`, `SetMap` and the transition
 * matrix and boundary-word code of the C# `FibredSurface`.
 *
 * @module
 */
import { EdgePath } from "./edge-path";
import type { Edge, GraphCopy, OrientedEdge, RibbonGraph, Vertex } from "./ribbon-graph";
import { TransitionMatrix } from "./transition-matrix";

/** How one boundary word of the source is mapped; see {@link CombinatorialMap.boundaryWordReport}. */
export interface BoundaryWordImage {
  readonly word: EdgePath;
  /** The image of `word`, cyclically reduced. */
  readonly image: EdgePath;
  /** The index of the target boundary word that `image` is a rotation of, or −1 if there is none. */
  readonly matchedIndex: number;
}

/**
 * A combinatorial map f from `source` to `target`: every vertex v goes to a vertex f(v), and every edge e to an
 * edge path f(e) from f(o(e)) to f(t(e)) (possibly empty if f(o(e)) = f(t(e))). The image of the reversed edge
 * is the inverse path.
 *
 * The map is mutable: the moves of the algorithm change images in place. {@link checkContinuity} verifies that
 * the images fit together.
 */
export class CombinatorialMap {
  private readonly vertexImages = new Map<Vertex, Vertex>();
  /** Images of the forward orientations. */
  private readonly edgeImages = new Map<Edge, EdgePath>();

  constructor(
    readonly source: RibbonGraph,
    readonly target: RibbonGraph,
  ) {}

  /** The identity map of `graph`. */
  static identity(graph: RibbonGraph): CombinatorialMap {
    const map = new CombinatorialMap(graph, graph);
    for (const v of graph.vertices) map.setVertexImage(v, v);
    for (const e of graph.edges) map.setImage(e.forward, EdgePath.of(e.forward));
    return map;
  }

  /**
   * The map with the given edge images; edges without an image are mapped to themselves (as in the C#
   * `ParseMap`, which requires `source === target` for that). Vertex images are read off the images of
   * the edges at each vertex.
   *
   * @throws Error if a vertex image can't be determined or is ambiguous, or the images are not continuous.
   */
  static fromEdgeImages(
    source: RibbonGraph,
    target: RibbonGraph,
    images: ReadonlyMap<OrientedEdge, EdgePath>,
  ): CombinatorialMap {
    const map = new CombinatorialMap(source, target);
    for (const e of source.edges) {
      const forward = images.get(e.forward);
      const backward = images.get(e.backward);
      if (forward !== undefined && backward !== undefined)
        throw new Error(`Both ${e.forward} and ${e.backward} have an image`);
      const image = forward ?? backward?.inverse;
      if (image !== undefined) map.setImage(e.forward, image);
      else if (source === target) map.setImage(e.forward, EdgePath.of(e.forward));
      else throw new Error(`The edge ${e} has no image`);
    }
    for (const v of source.vertices) {
      const candidates = new Set(
        source
          .star(v)
          .map((e) => map.image(e).source)
          .filter((w) => w !== undefined),
      );
      if (candidates.size !== 1)
        throw new Error(
          candidates.size === 0
            ? `The image of the vertex ${v} can't be determined: all edges at ${v} have empty images`
            : `The images of the edges at ${v} start at different vertices: ${[...candidates].join(", ")}`,
        );
      map.setVertexImage(v, [...candidates][0] as Vertex);
    }
    const problems = map.checkContinuity();
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return map;
  }

  // ─── Images ───────────────────────────────────────────────────────────────────────────────────

  /** f(v). */
  vertexImage(v: Vertex): Vertex {
    const w = this.vertexImages.get(v);
    if (w === undefined) throw new Error(`The vertex ${v} has no image`);
    return w;
  }

  /** f(e); for the backward orientation, the inverse of the forward image. */
  image(e: OrientedEdge): EdgePath {
    const image = this.edgeImages.get(e.edge);
    if (image === undefined) throw new Error(`The edge ${e.edge} has no image`);
    return e.isForward ? image : image.inverse;
  }

  /** f(e₁ ⋯ eₙ) = f(e₁) ⋯ f(eₙ), without cancellation. */
  imageOfPath(path: EdgePath): EdgePath {
    return EdgePath.concatAll(path.letters.map((e) => this.image(e)));
  }

  setVertexImage(v: Vertex, w: Vertex): void {
    this.vertexImages.set(v, w);
  }

  /** Sets f(e) (for the backward orientation: f(ē) is set to the inverse). */
  setImage(e: OrientedEdge, image: EdgePath): void {
    this.edgeImages.set(e.edge, e.isForward ? image : image.inverse);
  }

  /** Forgets the image of an edge that was removed from the source graph. */
  forgetEdge(edge: Edge): void {
    this.edgeImages.delete(edge);
  }

  /** Forgets the image of a vertex that was removed from the source graph. */
  forgetVertex(v: Vertex): void {
    this.vertexImages.delete(v);
  }

  /** Df(e): the first letter of f(e), or `undefined` if f(e) is empty (e is pretrivial). */
  derivative(e: OrientedEdge): OrientedEdge | undefined {
    return this.image(e).first;
  }

  /**
   * Changes all images after a change of the *target* graph: every letter is replaced by `replacement(edge)`
   * (forward orientation; backward letters get the inverse), or kept if it returns `undefined`.
   * Used when an edge of the target is subdivided or folded.
   */
  substituteInImages(replacement: (edge: Edge) => EdgePath | undefined): void {
    const image = (edge: Edge) => replacement(edge) ?? EdgePath.of(edge.forward);
    for (const [e, path] of this.edgeImages) this.edgeImages.set(e, path.substitute(image));
  }

  /** The composition `this ∘ first`: first apply `first`, then this map. Requires `first.target === this.source`. */
  after(first: CombinatorialMap): CombinatorialMap {
    if (first.target !== this.source) throw new Error("The maps can't be composed: the graphs don't match");
    const result = new CombinatorialMap(first.source, this.target);
    for (const v of first.source.vertices) result.setVertexImage(v, this.vertexImage(first.vertexImage(v)));
    for (const e of first.source.edges) result.setImage(e.forward, this.imageOfPath(first.image(e.forward)));
    return result;
  }

  /**
   * A copy of this map between copies of the graphs. Pass the {@link GraphCopy} of the source and, if the
   * target is a different graph that was also copied, of the target; otherwise the copy maps into the same
   * target graph.
   */
  copy(
    sourceCopy: GraphCopy,
    targetCopy: GraphCopy | undefined = this.source === this.target ? sourceCopy : undefined,
  ): CombinatorialMap {
    const targetGraph = targetCopy?.graph ?? this.target;
    const vertexInTarget = (w: Vertex) => targetCopy?.vertexMap.get(w) ?? w;
    const orientInTarget = targetCopy?.orient ?? ((e: OrientedEdge) => e);
    const result = new CombinatorialMap(sourceCopy.graph, targetGraph);
    for (const [v, w] of this.vertexImages)
      result.setVertexImage(sourceCopy.vertexMap.get(v) as Vertex, vertexInTarget(w));
    for (const [e, path] of this.edgeImages)
      result.setImage(
        (sourceCopy.edgeMap.get(e) as Edge).forward,
        EdgePath.from(path.letters.map(orientInTarget)),
      );
    return result;
  }

  // ─── Derived data ─────────────────────────────────────────────────────────────────────────────

  /**
   * The transition matrix: the entry in row e′ and column e counts the occurrences of e′ in f(e).
   * Rows default to the edges of the target, columns to the edges of the source.
   */
  transitionMatrix(
    rows: readonly Edge[] = this.target.edges,
    columns: readonly Edge[] = this.source.edges,
  ): TransitionMatrix {
    const images = columns.map((e) => this.image(e.forward));
    return new TransitionMatrix(
      rows,
      columns,
      rows.map((row) => images.map((image) => image.count(row))),
    );
  }

  /** The sum of the lengths of all edge images. For μ this is the number of side crossings. */
  totalLength(): number {
    let total = 0;
    for (const path of this.edgeImages.values()) total += path.length;
    return total;
  }

  /**
   * Checks that f is a well-defined combinatorial map: every vertex and edge of the source has an image in
   * the target, and each f(e) is a continuous path from f(o(e)) to f(t(e)) (empty only if these coincide).
   * Returns a description of every problem found (empty if there is none).
   */
  checkContinuity(): string[] {
    const problems: string[] = [];
    for (const v of this.source.vertices) {
      const w = this.vertexImages.get(v);
      if (w === undefined) problems.push(`The vertex ${v} has no image`);
      else if (!this.target.hasVertex(w)) problems.push(`The image ${w} of ${v} is not in the target graph`);
    }
    for (const e of this.source.edges) {
      const path = this.edgeImages.get(e);
      if (path === undefined) {
        problems.push(`The edge ${e} has no image`);
        continue;
      }
      const from = this.vertexImages.get(e.source);
      const to = this.vertexImages.get(e.target);
      const describe = `f(${e}) = ${path.toString() || "(empty)"}`;
      if (path.letters.some((letter) => !this.target.hasEdge(letter.edge)))
        problems.push(`${describe} uses edges that are not in the target graph`);
      else if (!path.isContinuous) problems.push(`${describe} is not a continuous path`);
      else if (path.isEmpty ? from !== to : path.source !== from || path.target !== to)
        problems.push(`${describe} does not run from f(${e.source}) = ${from} to f(${e.target}) = ${to}`);
    }
    return problems;
  }

  /**
   * For each boundary word of the source (or of the subgraph `sourceSubgraph`), its cyclically reduced
   * image and which target boundary word it equals up to rotation. By the thesis (§ "Reconstructing f from
   * g"), a map is geometric iff all boundary words are preserved (and χ is preserved).
   *
   * The target words default to the boundary words of the same subgraph if source and target are the same
   * graph (for g), and to all boundary words of the target otherwise (for μ). Target words are cyclically
   * reduced too, which matters for subgraphs with valence-1 vertices.
   */
  boundaryWordReport(
    sourceSubgraph?: ReadonlySet<Edge>,
    targetWords: readonly EdgePath[] = this.source === this.target
      ? this.target.boundaryWords(sourceSubgraph)
      : this.target.boundaryWords(),
  ): BoundaryWordImage[] {
    const reducedTargets = targetWords.map((w) => w.cyclicallyReduced());
    return this.source.boundaryWords(sourceSubgraph).map((word) => {
      const image = this.imageOfPath(word).cyclicallyReduced();
      return { word, image, matchedIndex: reducedTargets.findIndex((t) => t.isRotationOf(image)) };
    });
  }

  /** Whether every boundary word is mapped onto a boundary word; see {@link boundaryWordReport}. */
  preservesBoundaryWords(sourceSubgraph?: ReadonlySet<Edge>): boolean {
    return this.boundaryWordReport(sourceSubgraph).every((b) => b.matchedIndex >= 0);
  }

  /** One line per edge: "a ↦ b A c". */
  toString(): string {
    return this.source.edges.map((e) => `${e} ↦ ${this.image(e.forward).toString() || "·"}`).join("\n");
  }
}
