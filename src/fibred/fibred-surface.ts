/**
 * The state of the Bestvina–Handel algorithm: a fibred surface, given by its spine G (a ribbon graph), the
 * carrying map g : G → G of the homeomorphism, and the inverse marking μ : G → G₀ that records how G is
 * embedded in the surface (docs/design/embedding.md). Replaces the core of the C# `partial class
 * FibredSurface` (`FibredSurface.cs`, `FibredSurfaceNamesAndColors.cs`, `FibredSurfacePeripheralSubgraphs.cs`
 * and the integrity checks of `FibredSurfaceAlgorithmSuggestionSystem.cs`).
 *
 * The moves live in their own modules as functions that change a `FibredSurface` in place.
 *
 * @module
 */
import type { Color } from "../math/color";
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { fromBoundaryWords } from "../graph/from-boundary-words";
import { parseMap } from "../graph/path-parser";
import type { Edge, RibbonGraph, StarPosition, Vertex } from "../graph/ribbon-graph";
import { firstDuplicate } from "../util/iter";
import {
  EDGE_COLORS,
  EDGE_NAMES,
  firstUnusedName,
  leastUsedColor,
  VERTEX_COLORS,
  VERTEX_NAMES,
} from "./names-and-colors";

/** The parts a {@link FibredSurface} is made of. */
export interface FibredSurfaceParts {
  readonly graph: RibbonGraph;
  /** The carrying map g : G → G. */
  readonly g: CombinatorialMap;
  /** The inverse marking μ : G → G₀. Defaults to the identity onto a copy of G (G₀ = the initial graph). */
  readonly mu?: CombinatorialMap;
  /** The peripheral subgraph P: one loop around each puncture except one orbit of punctures. */
  readonly peripheral?: Iterable<Edge>;
}

export class FibredSurface {
  /** The spine G of the fibred surface; its edges are the strips, its vertices the junctions. */
  readonly graph: RibbonGraph;
  /** The carrying map g : G → G. */
  readonly g: CombinatorialMap;
  /** The inverse marking μ : G → G₀. */
  readonly mu: CombinatorialMap;
  /**
   * The peripheral subgraph P. Its vertices have valence 2 in P, and g acts on P as a graph automorphism.
   */
  readonly peripheral: Set<Edge>;
  /** Set when the user chose to continue although the map is reducible. */
  ignoreReducible = false;
  /** Set once the fibred surface has been converted into a train track. */
  isTrainTrack = false;
  /**
   * Receives messages about inconsistent states that a move detected but could recover from (the C#
   * `OnError` event). Defaults to `console.error`; the UI shows them to the user.
   */
  onError: (message: string) => void = (message) => console.error(message);

  constructor(parts: FibredSurfaceParts) {
    this.graph = parts.graph;
    this.g = parts.g;
    if (this.g.source !== this.graph || this.g.target !== this.graph)
      throw new Error("g must map the graph of the fibred surface to itself");
    this.mu = parts.mu ?? markingByCopy(this.graph);
    if (this.mu.source !== this.graph)
      throw new Error("μ must be defined on the graph of the fibred surface");
    this.peripheral = new Set(parts.peripheral ?? []);
  }

  /**
   * A fibred surface given by the boundary words of its spine and its graph map as text, e.g.
   * `FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b")`. Edges not mentioned in the map
   * are mapped to themselves.
   */
  static fromText(
    boundaryWords: readonly (readonly string[])[],
    map: string,
    peripheralEdgeNames: readonly string[] = [],
  ): FibredSurface {
    const graph = fromBoundaryWords(boundaryWords);
    const g = CombinatorialMap.fromEdgeImages(graph, graph, parseMap(map, graph).images);
    const peripheral = graph.edges.filter((e) => peripheralEdgeNames.includes(e.name));
    return new FibredSurface({ graph, g, peripheral });
  }

  /** The reference spine G₀ (the target of μ). */
  get spine0(): RibbonGraph {
    return this.mu.target;
  }

  /**
   * An independent copy, for branching (exploring several suggestions). G₀ is shared, since no move
   * changes it; μ of the copy maps into the same G₀.
   */
  copy(): FibredSurface {
    const graphCopy = this.graph.copy();
    const result = new FibredSurface({
      graph: graphCopy.graph,
      g: this.g.copy(graphCopy, graphCopy),
      mu: this.mu.copy(graphCopy, undefined),
      peripheral: [...this.peripheral].map((e) => graphCopy.edgeMap.get(e) as Edge),
    });
    result.ignoreReducible = this.ignoreReducible;
    result.isTrainTrack = this.isTrainTrack; // the C# Copy() forgot this flag
    result.onError = this.onError;
    return result;
  }

  // ─── Creating and removing strips and junctions ─────────────────────────────────────────────

  /** A new junction with the next free name and the least used vertex colour. */
  addJunction(options: { name?: string; color?: Color } = {}): Vertex {
    return this.graph.addVertex(
      options.name ?? this.nextVertexName(),
      options.color ??
        leastUsedColor(
          VERTEX_COLORS,
          this.graph.vertices.map((v) => v.color),
        ),
    );
  }

  /**
   * A new strip with the next free name and the least used edge colour. Its images under g and μ must be
   * set by the caller.
   */
  addStrip(
    source: Vertex,
    target: Vertex,
    options: { name?: string; color?: Color; atSource?: StarPosition; atTarget?: StarPosition } = {},
  ): Edge {
    return this.graph.addEdge(source, target, {
      ...options,
      name: options.name ?? this.nextEdgeName(),
      color:
        options.color ??
        leastUsedColor(
          EDGE_COLORS,
          this.graph.edges.map((e) => e.color),
        ),
    });
  }

  /** Removes a strip from the graph, from g and μ, and from the periphery. */
  removeStrip(edge: Edge): void {
    this.graph.removeEdge(edge);
    this.g.forgetEdge(edge);
    this.mu.forgetEdge(edge);
    this.peripheral.delete(edge);
  }

  /** Removes a junction (which must have no strips left) from the graph and from g and μ. */
  removeJunction(v: Vertex): void {
    this.graph.removeVertex(v);
    this.g.forgetVertex(v);
    this.mu.forgetVertex(v);
  }

  nextEdgeName(): string {
    return firstUnusedName(EDGE_NAMES, new Set(this.graph.edges.map((e) => e.name.toLowerCase())));
  }

  nextVertexName(): string {
    return firstUnusedName(VERTEX_NAMES, new Set(this.graph.vertices.map((v) => v.name)));
  }

  // ─── Subgraphs ───────────────────────────────────────────────────────────────────────────────

  /**
   * The layers P₀ = P, P₁, P₂, … of the pre-periphery: Pᵢ consists of the edges not in earlier layers whose
   * g-image only uses edges of earlier layers. So all edges in the union are eventually mapped into P.
   */
  prePeripheralLayers(): Set<Edge>[] {
    const layers = [new Set(this.peripheral)];
    const remaining = new Set(this.graph.edges.filter((e) => !this.peripheral.has(e)));
    while (remaining.size > 0) {
      const layer = new Set(
        [...remaining].filter((e) => this.g.image(e.forward).letters.every((f) => !remaining.has(f.edge))),
      );
      if (layer.size === 0) break;
      layers.push(layer);
      for (const e of layer) remaining.delete(e);
    }
    return layers;
  }

  /** P ∪ pre-P: all edges that are eventually mapped into the periphery P. */
  prePeriphery(): Set<Edge> {
    return new Set(this.prePeripheralLayers().flatMap((layer) => [...layer]));
  }

  /**
   * The essential subgraph H: the edges outside the pre-periphery. These are the edges that don't become
   * infinitesimal with respect to the lengths given by the Perron–Frobenius eigenvector.
   */
  essentialSubgraph(): Set<Edge> {
    const prePeriphery = this.prePeriphery();
    return new Set(this.graph.edges.filter((e) => !prePeriphery.has(e)));
  }

  // ─── Consistency ─────────────────────────────────────────────────────────────────────────────

  /**
   * Checks the invariants that every move must preserve, and returns a description of each violation (empty
   * if there is none). Run after every move; the C# `CheckIntegrityOfGraphMap`, extended by checks of μ.
   */
  checkIntegrity(): string[] {
    const problems: string[] = [];
    try {
      this.graph.checkConsistency();
    } catch (error) {
      problems.push((error as Error).message);
    }
    problems.push(...this.g.checkContinuity().map((p) => `g: ${p}`));
    problems.push(...this.mu.checkContinuity().map((p) => `μ: ${p}`));
    if (problems.length > 0) return problems; // the checks below assume well-defined maps

    for (const e of this.graph.edges)
      if (e.isLoop && this.g.image(e.forward).isEmpty)
        problems.push(
          `The loop ${e} is mapped to a vertex, i.e. a non-forest is mapped into a forest. This can't happen for a homotopy equivalence.`,
        );

    const duplicateEdge = firstDuplicate(this.graph.edges, (e) => e.name.toLowerCase());
    if (duplicateEdge !== undefined) problems.push(`The edge name ${duplicateEdge.name} is used twice`);
    const duplicateVertex = firstDuplicate(this.graph.vertices, (v) => v.name);
    if (duplicateVertex !== undefined) problems.push(`The vertex name ${duplicateVertex.name} is used twice`);

    // Strips at a junction whose images start with the same strip must be adjacent in the cyclic order,
    // since the homeomorphism preserves the cyclic order.
    for (const v of this.graph.vertices) {
      const star = this.graph.star(v);
      const byDerivative = Map.groupBy(star, (e) => this.g.derivative(e));
      for (const [first, edges] of byDerivative)
        if (first !== undefined && !isCyclicInterval(star, new Set(edges)))
          problems.push(
            `The edges ${edges.join(", ")} all start with ${first} under g, but are not adjacent in the star of ${v}`,
          );
    }

    for (const b of this.mu.boundaryWordReport())
      if (b.matchedIndex < 0)
        problems.push(
          `μ maps the boundary word ${b.word} to ${b.image.toString() || "(empty)"}, which is not a boundary word of G₀`,
        );
    return problems;
  }

  /** Reports an inconsistency through {@link onError} (the C# `HandleInconsistentBehavior`). */
  reportInconsistency(message: string): void {
    this.onError(message);
  }

  toString(): string {
    return this.g.toString();
  }
}

/** μ = the identity onto a copy of `graph`, i.e. G₀ is (a copy of) the current graph. */
function markingByCopy(graph: RibbonGraph): CombinatorialMap {
  const copy = graph.copy();
  const mu = new CombinatorialMap(graph, copy.graph);
  for (const v of graph.vertices) mu.setVertexImage(v, copy.vertexMap.get(v) as Vertex);
  for (const e of graph.edges) mu.setImage(e.forward, EdgePath.of(copy.orient(e.forward)));
  return mu;
}

/** Whether the elements of `subset` form one cyclically consecutive block of `cycle` (or `subset` is empty). */
export function isCyclicInterval<T>(cycle: readonly T[], subset: ReadonlySet<T>): boolean {
  let blockStarts = 0;
  cycle.forEach((x, i) => {
    if (subset.has(x) && !subset.has(cycle[(i - 1 + cycle.length) % cycle.length] as T)) blockStarts++;
  });
  return blockStarts <= 1;
}
