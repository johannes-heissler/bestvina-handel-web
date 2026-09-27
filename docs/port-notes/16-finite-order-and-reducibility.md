# 16 — Finite order and reducibility

**C# source:** `FiniteOrderSuggestion` in `FibredSurfaceGraphOperations.cs`, `FibredSurfaceReduction.cs` (612 lines),
`GetMaximalInvariantSubgraphDeformationRetractingTo` in `FibredSurfaceAbsorbingIntoPeriphery.cs`; the thesis, § "Reducibility
and the periphery" and § "Reducing reducible maps"
**Target:** `src/fibred/moves/reducibility.ts`, `classify` in `src/fibred/algorithm.ts`
**Status:** 🔍 16a ported (finite order, detection, reducing to the invariant subgraph); 16b (reducing to the complement) follows

## Finite order

If every strip is mapped to a single strip, g is a graph automorphism, and the mapping class has finite order: the least common
multiple of the cycle lengths of the permutation of the oriented strips. `finiteOrder(fs)` checks that this really is a
bijection, and reports it otherwise. (C#'s `FindEdgeCycles` received both orientations of each strip and then added the reversed
ones again, so it saw every oriented strip twice.)

## Detecting reducibility

As in C# and the Corollary "Reducibility and essential edges": the orbit of every essential strip (outside the pre-periphery)
that isn't the whole graph is an invariant proper subgraph, hence a reduction. Candidates with the same **maximal invariant
subgraph that deformation retracts to them** are merged, keeping the smallest orbit. If that maximal subgraph is a forest, the
peripheral components it touches are added (the proof of the Corollary), and it is dropped if that gives the whole graph.

`maximalInvariantSubgraphRetractingTo(fs, base)` adds orbits whose new strips form a forest touching the current subgraph in
exactly one junction per component. **Change:** C# went through the strips only once, so an orbit rejected early was never
tried again after the subgraph grew. The thesis restarts after each extension, and so does the port (a fixpoint). The C# helper
also passed its subgraph to `IsPeripheryFriendlySubforest`, which ignored it (port note 11), so the C# check used the
periphery P instead of the subgraph.

## Reducing to the invariant subgraph ("Reduce to subgraph")

1. **Prepare:** collapse the trees that the maximal invariant subgraph hangs off the chosen subgraph, towards junctions of the
   subgraph (the C# `PrepareReduction`).
2. **Choose a component** C of the subgraph (a callback; the default is the first). If g permutes k components, **g is replaced by
   the first return map g^k**, computed before the other components are deleted, since g maps C into them. C# only did this for the
   reduction to the complement.
3. **Delete everything else.**

The result is a fibred surface for a **subsurface** of the original surface. μ still records its embedding (as an inclusion),
but the boundary words of G that aren't punctures are now mapped to the reduction curves. These are recorded in
**`FibredSurface.reductionCurves`** (cyclically reduced closed paths in G₀), and the integrity check accepts μ(boundary word) =
a boundary word of G₀ or a reduction curve, in either orientation. (A first version had a boolean `isSubsurface` that switched
the check off.)

## In the algorithm

At the C# position (after removing valence-1 junctions), `nextStep` now stops at a graph automorphism, and at a reduction unless
`ignoreReducible` is set (the C# button "Ignore and continue", which the C# autopilot always chose). `classify(fs)` returns
`finite order` (with the order), `reducible` (with the candidates), `pseudo-Anosov` (with λ, once no step applies anymore), or
`undecided`.

## Tests

`src/fibred/moves/reducibility.test.ts` (9 tests):

- **finite order:** a rotation of order 4, the identity, swapping the handles of a genus-2 surface (order 2), and none for an Anosov
  map;
- **reducible:** the Anosov map on one handle and the identity on the other: the candidates {a, b}, {c}, {d}. Reducing to {a, b} gives
  the Anosov map (growth φ²), reducing to {c, d} gives the identity;
- **first return map:** two loops swapped by g give g² on one of them;
- the maximal invariant subgraph: a strip joining two components is not added, and a stem attaching at one junction is.

`src/fibred/algorithm.test.ts`: `classify` recognizes the three types, and the algorithm stops at a reduction.
