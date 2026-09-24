# 05 — Ribbon graph

**C# source:** QuikGraph `UndirectedGraph<Junction, UnorientedStrip>`, `Helpers/GraphHelpers.cs`, the
orientation and cyclic-order parts of `FibredSurfaces/Strip.cs`, `Star`/`StarOrdered`/`SubgraphStarOrdered`
in `FibredSurfaceGraphOperations.cs`, and `SurfaceGenerator.GraphFromBoundaryWords`
**Target:** `src/graph/` (`ribbon-graph.ts`, `names.ts`, `from-boundary-words.ts`)
**Status:** ✅ ported (modules 3 and 4 moved behind the combinatorial core, see below). **Decisions
marked 🔍 need review.**

## What the C# code does

- The graph is a QuikGraph `UndirectedGraph` of junctions and `UnorientedStrip`s. An `UnorientedStrip`
  caches its `ReverseStrip`, so each oriented edge is a unique object. Setting `Source`/`Target` on a strip
  removes the edge from the graph and adds it back.
- **The cyclic order is stored as float numbers** `OrderIndexStart`/`OrderIndexEnd` on each strip. The star
  of a vertex is sorted by them. The moves keep these numbers up to date with tricks such as `-1`,
  `Count + 1` or `OrderIndexEnd + scale * index` to insert edges in between.
- Subgraphs (the peripheral subgraph, forests to collapse, invariant subgraphs) are separate QuikGraph
  instances that share edge objects with the main graph. The comment in `Strip.cs` about a QuikGraph bug
  after changing `Source` points out that these copies are not updated when an edge changes.
- Only three graph algorithms are used: connected components (`ComponentGraphs`), acyclicity
  (`IsUndirectedAcyclicGraph`), and the cyclic order around a subgraph (`SubgraphStarOrdered`).

## The TypeScript design

**🔍 D1: an explicit rotation system instead of float order indices.** `RibbonGraph` stores for each vertex its
**star**: the list of outgoing oriented edges in cyclic order. All changes go through graph methods, which
keep the stars consistent: `addEdge(u, v, { atSource: { after: e } })`, `reattach(e, w, { before: f })`,
`removeEdge`, `setStar`. Queries: `star(v)`, `next(e)` = σ(e), `previous(e)`, `nextAlongBoundary(e)` = σ(ē),
`boundaryWords()`, `valence(v)`, `eulerCharacteristic`, `checkConsistency()`. Each move then says _where_
edges go in the cyclic order, instead of computing numbers that sort into the right place.

**D2: one concrete graph type for G and G₀.** `Vertex` and `Edge` carry a name and a colour; an `Edge` owns its two
`OrientedEdge`s (`e.forward`, `e.backward`, `e.forward.reversed === e.backward`). The spine G of the
fibred surface and the reference spine G₀ (dual to the polygon) are both `RibbonGraph`s. In the
fibred-surface code, "strip" = edge and "junction" = vertex.

**🔍 D3: no data on edges beyond name, colour and endpoints.** In particular, **no edge path**: g(e) and μ(e)
live in `CombinatorialMap` objects (module 6, [design/embedding.md](../design/embedding.md)). There's also no
curve (the embedding layer computes curves) and no back-reference to the fibred surface.

**🔍 D4: subgraphs are `Set<Edge>`.** A subgraph is just a set of edges (plus, where needed, a set of
vertices). `components(edges)`, `isForest(edges)` and `starOfSubgraph(v, edges)` work on such sets. There
are no separate graph objects that could get out of sync, which removes the QuikGraph problem above.

**D5: names.** `invertName("a") === "A"` (the C# `ReverseUpper`, moved here from the helpers because G₀
uses the same convention). It throws for names without a letter instead of crashing. `OrientedEdge.name`
applies it.

**D6: conventions** (as in the thesis and in C#): σ(e) is the successor of e in the star of its source; a
boundary word e₁ ⋯ eₙ satisfies eᵢ₊₁ = σ(ēᵢ). Whether the stars are _counterclockwise_ in the picture is decided
by the embedding layer, which has to be consistent with the orientation of the model polygon.

**D7: deterministic order.** Vertices and edges are iterated in insertion order (JavaScript `Map`/`Set`
guarantee it), so boundary words, components and all printed output are reproducible.

## Bug fixed

`SurfaceGenerator.GraphFromBoundaryWords` closes each word with
`sigma[previous.Reversed()] = edges[b[0].ToLower()]`, i.e. with the _forward_ orientation of the first
letter even if the word starts with an inverse letter such as `"A"`. That gives a wrong cyclic order. The port
(`fromBoundaryWords`) uses the first letter with its orientation, and a test checks a word starting with `A`.

## Not ported

- `GraphHelpers.Deconstruct(TaggedEdge)`: only used by the UI's history graph (`FibredSurfaceMenu`), which
  gets its own simple data structure in the UI module.
- `SortConnectedSet`, `IsConnectedSet` (gates in cyclic order): they belong to the gates in module 6.

## Tests

`src/graph/ribbon-graph.test.ts` (14 tests): oriented-edge identities, insertion positions in stars, σ and σ⁻¹ with
wrap-around, consistency after removing and reattaching edges, `fromBoundaryWords` recovering its input for
five surfaces (including the case that was buggy in C#), χ = 2 − 2g − b, components and forests of edge
subsets, and the star of a contracted tree, which is the same whichever vertex of the tree you start at.

## Change of the module order

With [the embedding design](../design/embedding.md), strips and junctions no longer refer to curves, so the
combinatorial core (graph → edge paths and combinatorial maps → moves) doesn't depend on the geometry
modules 3 and 4. They move behind the core and will be ported together with the new embedding layer.
