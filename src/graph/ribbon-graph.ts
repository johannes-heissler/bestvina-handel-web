/**
 * Ribbon graphs: finite graphs (loops and multiple edges allowed) with a cyclic order of the edge ends
 * at every vertex. Used for the spine G of the fibred surface and for the reference spine G₀.
 * Replaces QuikGraph's `UndirectedGraph` and the float `OrderIndexStart/End` of the C# strips.
 *
 * Terminology and conventions (as in the thesis):
 * - Every edge e has two orientations, `e.forward` and `e.backward`; `ē` denotes the reversed
 *   orientation. Orientations are unique objects, so they can be compared with `===`.
 * - The **star** of a vertex v lists the oriented edges starting at v in their cyclic order; a loop appears
 *   twice. σ(e) is the successor of e in the star of its source (see {@link RibbonGraph.next}).
 * - A **boundary word** is a cyclic sequence e₁ e₂ ⋯ eₙ with eᵢ₊₁ = σ(ēᵢ). Each oriented edge lies in exactly
 *   one boundary word. The boundary words correspond to the boundary components (punctures) of the
 *   thickened surface.
 * - Names: the forward orientation carries the edge's name ("a"), the backward one its inverse name ("A").
 *
 * @module
 */
import { Color } from "../math/color";
import { invertName } from "./names";

/** A vertex (junction). Its star is stored in the graph. */
export class Vertex {
  constructor(
    /** Unique within its graph; used for stable ordering and debugging, not for identity. */
    readonly id: number,
    public name: string,
    public color: Color,
  ) {}

  toString(): string {
    return this.name;
  }
}

/** An unoriented edge (strip). Its endpoints are changed only through {@link RibbonGraph} methods. */
export class Edge {
  readonly forward: OrientedEdge;
  readonly backward: OrientedEdge;
  /** @internal Use {@link RibbonGraph} methods to change the endpoints. */
  _source: Vertex;
  /** @internal */
  _target: Vertex;

  constructor(
    readonly id: number,
    /** The name of the forward orientation; by convention lowercase. */
    public name: string,
    public color: Color,
    source: Vertex,
    target: Vertex,
  ) {
    this._source = source;
    this._target = target;
    this.forward = new OrientedEdge(this, true);
    this.backward = new OrientedEdge(this, false);
  }

  get source(): Vertex {
    return this._source;
  }

  get target(): Vertex {
    return this._target;
  }

  get isLoop(): boolean {
    return this._source === this._target;
  }

  toString(): string {
    return this.name;
  }
}

/** One of the two orientations of an {@link Edge}. */
export class OrientedEdge {
  /** @internal Created only by {@link Edge}. */
  constructor(
    readonly edge: Edge,
    readonly isForward: boolean,
  ) {}

  /** The same edge with the opposite orientation, ē. */
  get reversed(): OrientedEdge {
    return this.isForward ? this.edge.backward : this.edge.forward;
  }

  get source(): Vertex {
    return this.isForward ? this.edge.source : this.edge.target;
  }

  get target(): Vertex {
    return this.isForward ? this.edge.target : this.edge.source;
  }

  /** "a" for the forward orientation, "A" for the backward one. */
  get name(): string {
    return this.isForward ? this.edge.name : invertName(this.edge.name);
  }

  get color(): Color {
    return this.edge.color;
  }

  toString(): string {
    return this.name;
  }
}

/** Where to insert a new edge end into a star. */
export type StarPosition =
  /** At the end of the star (the cyclic order doesn't care where "the end" is). */
  | { readonly at: "end" }
  /** Directly after (σ-successor of) the given oriented edge, which must start at the same vertex. */
  | { readonly after: OrientedEdge }
  /** Directly before the given oriented edge. */
  | { readonly before: OrientedEdge };

const AT_END: StarPosition = { at: "end" };

/** The result of {@link RibbonGraph.copy}: the new graph and the correspondence to the old one. */
export interface GraphCopy {
  readonly graph: RibbonGraph;
  readonly vertexMap: Map<Vertex, Vertex>;
  readonly edgeMap: Map<Edge, Edge>;
  /** The oriented edge of the copy corresponding to an oriented edge of the original. */
  readonly orient: (e: OrientedEdge) => OrientedEdge;
}

/**
 * A ribbon graph. All changes go through its methods, which keep the stars consistent.
 * Iteration orders (of vertices and edges) are the insertion orders, so all results are deterministic.
 */
export class RibbonGraph {
  private readonly stars = new Map<Vertex, OrientedEdge[]>();
  private readonly edgeSet = new Set<Edge>();
  private nextVertexId = 0;
  private nextEdgeId = 0;

  // ─── Queries ──────────────────────────────────────────────────────────────────────────────────

  get vertices(): readonly Vertex[] {
    return [...this.stars.keys()];
  }

  get edges(): readonly Edge[] {
    return [...this.edgeSet];
  }

  /** Both orientations of every edge: e₁, ē₁, e₂, ē₂, … */
  get orientedEdges(): readonly OrientedEdge[] {
    return this.edges.flatMap((e) => [e.forward, e.backward]);
  }

  get vertexCount(): number {
    return this.stars.size;
  }

  get edgeCount(): number {
    return this.edgeSet.size;
  }

  /** χ = V − E. */
  get eulerCharacteristic(): number {
    return this.vertexCount - this.edgeCount;
  }

  hasVertex(v: Vertex): boolean {
    return this.stars.has(v);
  }

  hasEdge(e: Edge): boolean {
    return this.edgeSet.has(e);
  }

  /** The oriented edges starting at `v`, in cyclic order. Loops appear twice. */
  star(v: Vertex): readonly OrientedEdge[] {
    return this.starOf(v);
  }

  /** The star of `v`, rotated so that it starts with `first`. */
  starFrom(first: OrientedEdge): OrientedEdge[] {
    const star = this.starOf(first.source);
    const i = this.indexInStar(first);
    return [...star.slice(i), ...star.slice(0, i)];
  }

  /** The valence of `v`: the number of edge ends at `v` (loops count twice). */
  valence(v: Vertex): number {
    return this.starOf(v).length;
  }

  /** σ(e): the successor of `e` in the cyclic order at its source. */
  next(e: OrientedEdge): OrientedEdge {
    const star = this.starOf(e.source);
    return star[(this.indexInStar(e) + 1) % star.length] as OrientedEdge;
  }

  /** σ⁻¹(e): the predecessor of `e` in the cyclic order at its source. */
  previous(e: OrientedEdge): OrientedEdge {
    const star = this.starOf(e.source);
    return star[(this.indexInStar(e) - 1 + star.length) % star.length] as OrientedEdge;
  }

  /** The oriented edge following `e` along its boundary word: σ(ē). */
  nextAlongBoundary(e: OrientedEdge): OrientedEdge {
    return this.next(e.reversed);
  }

  /**
   * All boundary words, each starting at its first oriented edge in the order of {@link orientedEdges}.
   * Together they contain every oriented edge exactly once.
   */
  boundaryWords(): OrientedEdge[][] {
    const visited = new Set<OrientedEdge>();
    const words: OrientedEdge[][] = [];
    for (const start of this.orientedEdges) {
      if (visited.has(start)) continue;
      const word: OrientedEdge[] = [];
      for (let e = start; !visited.has(e); e = this.nextAlongBoundary(e)) {
        visited.add(e);
        word.push(e);
      }
      words.push(word);
    }
    return words;
  }

  /**
   * The connected components, each as the set of its vertices and the set of its edges. Only the edges in
   * `edges` (default: all) are used, and only their endpoints (plus, if no subset is given, isolated
   * vertices) appear. This replaces QuikGraph's `ConnectedComponents` and `ComponentGraphs`.
   */
  components(edges?: Iterable<Edge>): { vertices: Set<Vertex>; edges: Set<Edge> }[] {
    const edgeList = edges === undefined ? this.edges : [...edges];
    const parent = new Map<Vertex, Vertex>();
    const find = (v: Vertex): Vertex => {
      let root = v;
      while (parent.get(root) !== root) root = parent.get(root) as Vertex;
      parent.set(v, root);
      return root;
    };
    const touch = (v: Vertex) => {
      if (!parent.has(v)) parent.set(v, v);
    };
    if (edges === undefined) for (const v of this.vertices) touch(v);
    for (const e of edgeList) {
      touch(e.source);
      touch(e.target);
      parent.set(find(e.source), find(e.target));
    }
    const byRoot = new Map<Vertex, { vertices: Set<Vertex>; edges: Set<Edge> }>();
    for (const v of parent.keys()) {
      const root = find(v);
      if (!byRoot.has(root)) byRoot.set(root, { vertices: new Set(), edges: new Set() });
      byRoot.get(root)?.vertices.add(v);
    }
    for (const e of edgeList) byRoot.get(find(e.source))?.edges.add(e);
    return [...byRoot.values()];
  }

  /** Whether the given edges (default: all) form a forest, i.e. contain no cycle (a loop is a cycle). */
  isForest(edges?: Iterable<Edge>): boolean {
    return this.components(edges).every((c) => c.edges.size === c.vertices.size - 1);
  }

  /**
   * The oriented edges leaving the connected subgraph `subgraph` (containing `start`), in the cyclic order
   * around it: the star of the vertex obtained by contracting the subgraph. Walks around the subgraph,
   * turning into the next edge σ(ē) whenever it reaches an edge of the subgraph.
   *
   * For a tree this is the star of the contracted vertex. For a subgraph with cycles, only the part of
   * the boundary that can be reached from `start` is returned (the C# `SubgraphStarOrdered`).
   */
  starOfSubgraph(start: Vertex, subgraph: ReadonlySet<Edge>): OrientedEdge[] {
    // The walk is an orbit of the bijection e ↦ (e ∈ subgraph ? σ(ē) : σ(e)) on oriented edges, so it
    // returns to the first edge it outputs, after at most 2·E steps.
    const star = this.starOf(start);
    const result: OrientedEdge[] = [];
    let e = star[0];
    for (let step = 0; e !== undefined && step <= 2 * this.edgeCount; step++) {
      if (subgraph.has(e.edge)) {
        e = this.next(e.reversed); // walk through the subgraph edge and continue after it
        continue;
      }
      if (e === result[0]) return result;
      result.push(e);
      e = this.next(e);
    }
    return result; // empty: no edge leaves the component of `start`
  }

  // ─── Changes ──────────────────────────────────────────────────────────────────────────────────

  addVertex(name?: string, color: Color = Color.BLACK): Vertex {
    const id = this.nextVertexId++;
    const v = new Vertex(id, name ?? `v${id}`, color);
    this.stars.set(v, []);
    return v;
  }

  /**
   * Adds an edge from `source` to `target`. `atSource` / `atTarget` say where its two ends go in the
   * cyclic orders (default: at the end).
   */
  addEdge(
    source: Vertex,
    target: Vertex,
    options: {
      name?: string;
      color?: Color;
      atSource?: StarPosition;
      atTarget?: StarPosition;
    } = {},
  ): Edge {
    this.assertVertex(source);
    this.assertVertex(target);
    const id = this.nextEdgeId++;
    const edge = new Edge(id, options.name ?? `e${id}`, options.color ?? Color.BLACK, source, target);
    this.edgeSet.add(edge);
    this.insertIntoStar(edge.forward, options.atSource ?? AT_END);
    this.insertIntoStar(edge.backward, options.atTarget ?? AT_END);
    return edge;
  }

  /** Removes an edge (from both stars). */
  removeEdge(edge: Edge): void {
    if (!this.edgeSet.delete(edge)) throw new Error(`Edge ${edge} is not in the graph`);
    this.removeFromStar(edge.forward);
    this.removeFromStar(edge.backward);
  }

  /**
   * Removes a vertex.
   *
   * @throws Error if edges are still attached; remove or reattach them first.
   */
  removeVertex(v: Vertex): void {
    if (this.starOf(v).length > 0)
      throw new Error(`Vertex ${v} still has edges: ${this.starOf(v).join(" ")}`);
    this.stars.delete(v);
  }

  /**
   * Moves the start of the oriented edge `e` to the vertex `newSource`, at the given position in its star.
   * (Moving the end of `e` is the same as moving the start of `ē`.)
   */
  reattach(e: OrientedEdge, newSource: Vertex, position: StarPosition = AT_END): void {
    this.assertVertex(newSource);
    this.removeFromStar(e);
    if (e.isForward) e.edge._source = newSource;
    else e.edge._target = newSource;
    this.insertIntoStar(e, position);
  }

  /**
   * Replaces the cyclic order at `v`. `star` must be a permutation of the current star.
   *
   * @throws Error otherwise.
   */
  setStar(v: Vertex, star: readonly OrientedEdge[]): void {
    const current = this.starOf(v);
    const same =
      star.length === current.length &&
      new Set(star).size === star.length &&
      star.every((e) => current.includes(e));
    if (!same) throw new Error(`New star of ${v} is not a permutation of the old one`);
    this.stars.set(v, [...star]);
  }

  /** A deep copy with fresh vertices and edges (same ids, names and colours) and the correspondence maps. */
  copy(): GraphCopy {
    const graph = new RibbonGraph();
    const vertexMap = new Map<Vertex, Vertex>();
    const edgeMap = new Map<Edge, Edge>();
    for (const v of this.vertices) {
      const w = new Vertex(v.id, v.name, v.color);
      graph.stars.set(w, []);
      vertexMap.set(v, w);
    }
    for (const e of this.edges) {
      const f = new Edge(
        e.id,
        e.name,
        e.color,
        vertexMap.get(e.source) as Vertex,
        vertexMap.get(e.target) as Vertex,
      );
      graph.edgeSet.add(f);
      edgeMap.set(e, f);
    }
    const orient = (e: OrientedEdge): OrientedEdge => {
      const f = edgeMap.get(e.edge);
      if (f === undefined) throw new Error(`Edge ${e.edge} is not in the copied graph`);
      return e.isForward ? f.forward : f.backward;
    };
    for (const [v, star] of this.stars) graph.stars.set(vertexMap.get(v) as Vertex, star.map(orient));
    graph.nextVertexId = this.nextVertexId;
    graph.nextEdgeId = this.nextEdgeId;
    return { graph, vertexMap, edgeMap, orient };
  }

  /**
   * Checks that every oriented edge appears exactly once, in the star of its source, and nothing else does.
   *
   * @throws Error describing the first inconsistency found.
   */
  checkConsistency(): void {
    const seen = new Set<OrientedEdge>();
    for (const [v, star] of this.stars)
      for (const e of star) {
        if (!this.edgeSet.has(e.edge))
          throw new Error(`Star of ${v} contains ${e}, which is not in the graph`);
        if (e.source !== v) throw new Error(`Star of ${v} contains ${e}, which starts at ${e.source}`);
        if (seen.has(e)) throw new Error(`${e} appears twice in the stars`);
        seen.add(e);
      }
    if (seen.size !== 2 * this.edgeSet.size) throw new Error("Some edge ends are missing from the stars");
  }

  // ─── Internals ────────────────────────────────────────────────────────────────────────────────

  private starOf(v: Vertex): OrientedEdge[] {
    const star = this.stars.get(v);
    if (star === undefined) throw new Error(`Vertex ${v} is not in the graph`);
    return star;
  }

  private indexInStar(e: OrientedEdge): number {
    const i = this.starOf(e.source).indexOf(e);
    if (i === -1) throw new Error(`${e} is not in the star of ${e.source}`);
    return i;
  }

  private insertIntoStar(e: OrientedEdge, position: StarPosition): void {
    const star = this.starOf(e.source);
    if ("at" in position) star.push(e);
    else if ("after" in position) star.splice(this.indexInStar(position.after) + 1, 0, e);
    else star.splice(this.indexInStar(position.before), 0, e);
  }

  private removeFromStar(e: OrientedEdge): void {
    this.starOf(e.source).splice(this.indexInStar(e), 1);
  }

  private assertVertex(v: Vertex): void {
    if (!this.stars.has(v)) throw new Error(`Vertex ${v} is not in the graph`);
  }
}
