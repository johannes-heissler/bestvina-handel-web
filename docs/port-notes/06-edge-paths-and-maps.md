# 06 — Edge paths and combinatorial maps

**C# source:** `FibredSurfaces/EdgePath.cs` (688 lines), `Strip.EdgePath`/`Dg`, `Junction.image`,
`FibredSurfaceChangeMap.cs` (parsing, `SetMap`), `TransitionMatrix` in `FibredSurfaceTransitionMatrixAndWeights.cs`,
`BoundaryWords`/`CheckIfBoundaryWordsOfSubgraphArePreserved` in `FibredSurfaceGraphOperations.cs`,
`Gate.cs` (edge cycles, gates), `EdgePoint.cs`
**Target:** `src/graph/edge-path.ts`, `src/graph/combinatorial-map.ts`, `src/graph/path-parser.ts`,
`src/fibred/gates.ts`
**Status:** ✅ approved 2026-09-25 with **decision C2** for Q1 (see below), and ported.

## What the C# code does

### `EdgePath`: a tree, not a list

`EdgePath` is an immutable **tree** of four kinds of nodes:

| Class               | Meaning                                          | Printed as         |
| ------------------- | ------------------------------------------------ | ------------------ |
| `NormalEdgePath`    | a plain sequence of oriented strips (the leaves) | `a B c`            |
| `NestedEdgePath`    | a concatenation of sub-paths                     | `(… …)`            |
| `NamedEdgePath`     | a user-defined variable, e.g. `x := a B A`       | `x` (inverse: `X`) |
| `ConjugateEdgePath` | u⁻¹ w u or u w u⁻¹, kept as such                 | `w^u`, `u°w`       |

It implements `IReadOnlyList<Strip>`, so algorithms see the flat letter sequence, while the display keeps the
user's structure. `Replace` (substituting paths for letters: the heart of pre- and post-composition and of
updating images during moves) works node by node and so **keeps names and conjugations through the moves**.
`Skip`/`Take` keep the structure where the cut doesn't go through a node. `Count` is cached, the inverse is
cached, and indexing walks the tree. `FromString` parses `a B (c d)' x^a b°c` with named definitions.

The tree also **shares structure**: `Image` (applying g to a path) builds a `NestedEdgePath` of the images, so
iterated images don't copy letters.

### Where the maps live

- g(e) is the property `Strip.EdgePath`. The `ReverseStrip` returns its inverse. g(v) is `Junction.image`.
  `Dg` is the first letter of g(e) (`null` for pretrivial edges).
- `SetMap` has three modes: **replace** the images, **precompose** (g ← g ∘ h), **postcompose** (g ← h ∘ g).
- `ParseMap` accepts `g(a) = …`, `a -> …`, `a ↦ …`, `x := …` (definition) and `a = …`. Edges that are not mentioned
  keep the identity. `x := …` lines define named paths.
- The transition matrix is a `Dictionary<strip, Dictionary<strip, int>>`: how often g(e) crosses e′.
- Boundary words of subgraphs (with the cyclic order restricted to the subgraph), and the check that g maps
  each boundary word, cyclically reduced, onto a boundary word.

### Gates and edge points

- `EdgeCycle.FindEdgeCycles` (80 lines) partitions the oriented edges by the eventual behaviour of Dg, using
  a placeholder strip `NullStripPlaceholder` for "Dg is undefined" (pretrivial edges). `Gate.FindGates` then
  groups the edges at each vertex by their cycle and phase.
- `EdgePoint(e, i)` is the point of the edge e that is mapped to the vertex between the letters i−1 and i of g(e).
  It is used for inefficiencies and folding. Its `Equals` accepts both edge points and junctions and is
  not symmetric.

### Problems found

1. **`EdgePath` overrides `Equals` but not `GetHashCode`.** So `HashSet<EdgePath>` and dictionaries compare
   edge paths by reference, e.g. `BoundaryWords().ToHashSet()` in `GraphString`. It's harmless there because
   boundary words are different objects anyway, but it's a trap.
2. `ConjugateEdgePath` inherits from `NestedEdgePath` (marked "todo: clean code"), so several `switch`es need
   `and not ConjugateEdgePath`.
3. `EdgePoint.Equals` isn't symmetric (`point.Equals(junction)` can be true while `junction.Equals(point)` is
   false), which breaks the contract of `Equals`.
4. `EdgeCycle` needs the placeholder strip because C# dictionaries can't have `null` keys.

## Proposal

### 1. `EdgePath`: flat and immutable

```ts
class EdgePath {
  readonly letters: readonly OrientedEdge[];
  get length(): number;
  get inverse(): EdgePath;                  // cached
  concat(other): EdgePath;                  // without cancellation
  concatReduced(other): { path; cancelled };// util/words
  slice(start, end?): EdgePath;             // replaces Skip/Take
  reduced(): EdgePath;                      // remove backtracking (pulling tight)
  cyclicallyReduced(): EdgePath;            // also cancel the ends against each other
  substitute(f: (e: Edge) => EdgePath): EdgePath; // the C# Replace; f gives the image of the forward
                                                  // orientation, the backward one is inverted
  equals(other): boolean; key: string;      // key for Map/Set use (edge ids)
  isClosed / source / target;
}
```

All algorithms (moves, transition matrices, gates, parsing results) work only on this.

### 2. Q1: what happens to named paths and conjugations?

> **Decision (2026-09-25): C2.** The moves break named paths and conjugations anyway, so they are not kept. The parser still accepts
> them and expands them right away. Two additions: the map is shown exactly as typed until the first move changes it
> (UI module), and later, display-only detection of powers and conjugates such as `(ab)³` or `w^u` in any path (a UI
> feature, independent of the core).

They're a display feature that the C# code carries through all moves. Options:

- **A. Keep a tree like in C#.** Most faithful, but every operation needs a case per node type, as now.
- **B. Flat paths plus an optional _expression_ for display (recommended).** Each image can carry a small
  expression tree (letters, sequences, named paths, conjugates) next to its flat letters. Substitution is
  applied to the expression as well, so names and conjugations survive the moves exactly as in C#. Operations
  that cut through a named part (`slice` in the middle of `x`) simply drop the expression, and the path is then
  displayed flat. Algorithms never look at the expression.
- **C. Drop them.** Named paths exist only in the text you enter, and everything is displayed flat after
  the first move.

B keeps what you have, with the algorithms isolated from it. Its cost is one extra small module
(`path-expression.ts`). **Which one do you want?** Or: how much do you use named paths and conjugation after
the first moves?

### 3. `CombinatorialMap`: your proposal

```ts
class CombinatorialMap {
  constructor(readonly source: RibbonGraph, readonly target: RibbonGraph);
  vertexImage(v): Vertex;                  // g(v)
  image(e: OrientedEdge): EdgePath;        // g(e); g(ē) = g(e)⁻¹
  imageOfPath(p: EdgePath): EdgePath;
  setImage(e, path);  setVertexImage(v, w);
  derivative(e): OrientedEdge | undefined; // Dg(e), undefined for pretrivial edges
  transitionMatrix(rows?, columns?): TransitionMatrix; // square for g, non-square for μ
  totalLength(): number;                   // for μ: the number of side crossings
  substituteInImages(f);                   // a change of the *target* graph (subdivision, fold)
  precompose(h) / postcompose(h);          // the SetMap modes
  copy(sourceCopy, targetCopy);            // follows GraphCopy correspondences
  checkContinuity(): Problem[];            // image(e) runs from g(o(e)) to g(t(e)), or is empty if they coincide
  boundaryWordReport(subgraph?): {...};    // which boundary words are preserved (for μ: mapped into G₀)
}
```

It lives in `src/graph/` because it only needs ribbon graphs. g is a `CombinatorialMap` from G to G, μ one from G to G₀.

**Continuity is checked, not assumed.** The C# code logs an error when two edges at a vertex have images
starting at different vertices (in the `FibredSurface` constructor). `checkContinuity()` makes that a
reusable check, which runs after every move in the tests.

**`TransitionMatrix`** gets a small class with explicit row and column edge lists and a dense `number[][]`,
ready for the Perron–Frobenius computation (a later module), instead of nested dictionaries.

### 4. Gates, much simpler

Two oriented edges e, e′ at the same vertex are in the same gate iff Dgᵏ(e) = Dgᵏ(e′) for some k. With N the number
of oriented edges, it suffices to check k = N: after N steps both are periodic (or undefined), and Dg is
injective on periodic edges. So:

```ts
gates(v) = groupBy(star(v), (e) => Dg ^ N(e)); // "undefined" is its own group, as the C# placeholder
```

That replaces `EdgeCycle` and `Gate.FindGates` (about 110 lines) with about 15, and needs no placeholder. The
`cycleDistance` of a gate (used by the train-track code) is still available as the distance to the cycle,
if the train-track move needs it; I'll check when porting that move.

### 5. `EdgePoint`

A small value class `{ edge: OrientedEdge, index }` with `reversed()`, a `key` that normalizes to the
forward orientation (so `equals` is symmetric), and `vertex` when the index is 0 or the length. It depends on the
current g (the index refers to g(e)), so it is created by the map: `map.edgePoint(e, i)`. It gets ported with the
inefficiencies (module 7+).

### 6. Parsing

`path-parser.ts` ports `EdgePath.FromString` (as a small recursive-descent parser, instead of the current
state machine with `ref` locals) and `ParseMap` with all accepted formats. Errors carry the position of the
problem. A property test checks that parsing a printed path gives the same path.

## Tests planned

- `EdgePath`: inverse is an involution, `(uv)⁻¹ = v⁻¹u⁻¹`, `reduced` equals `util/words.reduceWord`, substitution
  respects orientation (`substitute` on `ē` gives the inverse image), cyclic reduction.
- `CombinatorialMap`: image of paths is a homomorphism (g(uv) = g(u)g(v)), composition is associative, pre- and
  postcomposition agree with composition, continuity check catches a broken image, the transition matrix
  counts correctly for a known example.
- Boundary words: for a known mapping class of the once-punctured torus (e.g. a ↦ ab, b ↦ bab), all boundary
  words are preserved, and after breaking one image they aren't.
- Gates: a hand-computed example, plus the C# `FindGates` results exported from an example run (golden test).
- Parser: every syntax from `ParseMap`, conjugation `^` and `°`, parentheses, inverse `'`, definitions, error
  positions, and the parse(print(p)) = p property.

---

## Port (done)

| File                             | Contents                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/graph/edge-path.ts`         | Flat immutable `EdgePath`: inverse (cached), `concat`, `concatReduced`, `slice`, `reduced`, `cyclicallyReduced`, `substitute`, `count`, `equals`, `isRotationOf`, `key`, continuity                                                                 |
| `src/graph/combinatorial-map.ts` | `CombinatorialMap`: images, `fromEdgeImages` (infers vertex images), `after` (composition), `substituteInImages`, `copy` along a `GraphCopy`, `transitionMatrix`, `totalLength`, `checkContinuity`, `boundaryWordReport` / `preservesBoundaryWords` |
| `src/graph/transition-matrix.ts` | `TransitionMatrix` with explicit row and column edges and dense entries                                                                                                                                                                             |
| `src/graph/path-parser.ts`       | `parseEdgePath` (recursive descent, same syntax as C#) and `parseMap` (all C# entry formats)                                                                                                                                                        |
| `src/fibred/gates.ts`            | `findGates` via Dgᴺ, with the optional grouping of junctions                                                                                                                                                                                        |

Also changed: `RibbonGraph.boundaryWords(subgraph?)` now returns `EdgePath`s and supports subgraphs (restricted
cyclic orders).

**Deviations from the proposal:** pre- and postcomposition are not separate methods; they are `h.after(g)` and
`g.after(h)`, and the fibred surface decides which one replaces g. `EdgePoint` is ported with the
inefficiencies (next modules), where it is used.

**Two more C# bugs fixed in `parseMap`:** definitions are processed in the order they appear (C# iterated an
unordered `HashSet`, so a definition using another one could fail at random), and a definition name with
an uppercase letter no longer crashes (C# lowercased the key and then looked up the lowercased key in the original
dictionary).

**Tests:** 35 in `edge-path.test.ts`, `path-parser.test.ts`, `combinatorial-map.test.ts` and `gates.test.ts`. Among them: the
torus map a ↦ ab, b ↦ bab (transition matrix, boundary word preserved, gates {a}, {b}, {A, B}), a μ-like map
between two different graphs, associativity of composition, the continuity checks, error positions of the
parser, and parse(print(p)) = p for 100 random paths.

### Later change: gates by Dg* (skipping pretrivial edges)

The C# gates (and the first port) iterate Dg and treat "Dg undefined" as one value, so every edge whose Dg-orbit runs
into a pretrivial edge fell into one gate with the pretrivial edges. Now the gates iterate **Dg***: e ↦ the first
letter of g(e) that is not pretrivial (`reducedDerivative` in `gates.ts`). The pretrivial edges (some power of g
maps them to a trivial path) are found from below (`pretrivialEdges`): first the edges with trivial image, then those
whose image consists only of edges found so far. Only the pretrivial edges themselves still form one gate per
junction. Dg* maps the non-pretrivial edges to themselves, so comparing Dg*ᴺ still suffices.

Dg* can take the two edges of a turn to different junctions (skipping a pretrivial letter crosses the pretrivial
forest). The train track follows the closure of the infinitesimal branches under Dg* only while both switches are at
the same junction; otherwise the pair is a turn only in the quotient by the pretrivial forest and gives no branch.
The inefficiencies still use Dg for their order and fold, since folding works on the actual first letters.

**Gates of pretrivial edges.** Dg* says nothing about pretrivial edges, and one gate of all pretrivial edges at a
junction (as in C#) could split another gate: at q in one of your examples, the pretrivial end B lay between d and z,
which Dg* puts into one gate (z ↦ C ↦ A1 ↦ d), so the gate was not consecutive and could not be drawn without a
crossing. Now a run of pretrivial edges in the star whose neighbours on both sides are in the same gate joins that
gate (collapsing the pretrivial forest brings those ends together anyway); any other run is a gate of its own. So
gates are consecutive whenever the gates of the other edges are.
