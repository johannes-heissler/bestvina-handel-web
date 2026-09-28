# 16 — Finite order and reducibility

**C# source:** `FiniteOrderSuggestion` in `FibredSurfaceGraphOperations.cs`, `FibredSurfaceReduction.cs` (612 lines),
`GetMaximalInvariantSubgraphDeformationRetractingTo` in `FibredSurfaceAbsorbingIntoPeriphery.cs`; the thesis, § "Reducibility
and the periphery" and § "Reducing reducible maps"
**Target:** `src/fibred/moves/reducibility.ts` (detection), `src/fibred/moves/reduce.ts` (the move), `classify` in `src/fibred/algorithm.ts`
**Status:** 🔍 ported: finite order, detection, and one move for all pieces of a reduction

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

## Reducing: one move for all pieces

"Reduce to subgraph" and "reduce to the complement" are one move, `reduce(fs, K, choose)` (your suggestion). The pieces are
the complementary regions of the reduction system, i.e. the components of the thesis's graph G′ = K′ ⊔ (complement):

1. **K′ = K** with g′ = g.
2. **The complement:** G ∖ K, plus two copies of every strip e of K (`e_r` on its right, `e_l` on its left), plus one new
   junction for every **sector** of a junction of K (between two consecutive strips x, σ_K(x) of K). The star of that
   junction is [left copy of x, the strips of St(K) in between, right copy of σ_K(x)]. The copies form one circle for
   each boundary word of K, and they become peripheral.
3. **The isotopy** of the Lemma "preserving boundary components": the image of each boundary circle of K is pulled
   tight as a cyclic word. Each sector junction moves along the cancelled stretch γ to the point where the tight circle
   passes, and every image at it is conjugated: g(e) ↦ γ(start)⁻¹ g(e) γ(end), reduced. **Change from the plan:**
   pulling tight one turn at a time wasn't enough. When a copy's image becomes empty, the next cancellation spans across it
   (the genus-2 test: `b · ∅ · B A B`).
4. **The lift to G′:** every letter of K in an image becomes its copy on one side, so that consecutive letters meet in
   the same sector. A turn can stay on the right side iff it is a boundary turn y = σ_K(x̄), and on the left iff
   x̄ = σ_K(y). The junctions mapped into K choose a sector there. This is solved as a small constraint problem
   (forward/backward reachable sets per path, arc consistency, then a greedy choice). If no lift exists, the move
   throws.
5. μ: sector junctions sit at their junction of K, and a copy has μ(copy) = μ(e).
6. **Choice:** the components of G′ with χ < 0 are offered as `ReductionPiece`s (`kind`, `edges`, `period`). g is
   replaced by g^period (before deleting the other pieces), the rest is deleted, and the boundary words of the piece that
   aren't punctures are recorded as reduction curves.

A piece of the complement then has the copies as peripheral circles, and **absorbing into the periphery** (the next step of
the algorithm) makes g an automorphism on them, as in the thesis.

**Changes compared to C#:**

- C#'s `PrepareReduction` (collapsing the trees that retract to K) is gone. Those trees stay strips of the complement.
  Collapsing a stem that leads to P would join P's circle to K, and then to the copies. That broke the pair-of-pants test.
- Circles of K (annuli) and components with χ ≥ 0 aren't offered.
- `needsAbsorbing` now also requires P's circles to be vertex-disjoint.

## Reduction curves

The result is a fibred surface for a **subsurface** of the original surface. μ still records its embedding (as an inclusion),
but the boundary words of G that aren't punctures now map to the reduction curves. These are recorded in
**`FibredSurface.reductionCurves`** (cyclically reduced closed paths in G₀). The integrity check accepts μ(boundary word) =
a boundary word of G₀ or a reduction curve, in either orientation. (A first version had a boolean `isSubsurface` that switched
the check off.)

## In the algorithm

At the C# position (after removing valence-1 junctions), `nextStep` now stops at a graph automorphism, and at a reduction unless
`ignoreReducible` is set (the C# button "Ignore and continue", which the C# autopilot always chose). `classify(fs)` returns
`finite order` (with the order), `reducible` (with the candidates), `pseudo-Anosov` (with λ, once no step applies anymore), or
`undecided`.

## Tests

`src/fibred/moves/reducibility.test.ts`: finite order (rotation of order 4, identity, swapping handles, none for Anosov);
the candidates {a, b}, {c}, {d} for the Anosov map on one handle; reducing to {a, b} (growth φ², the reduction curve
a b A B recorded, and the integrity check fails without it) and to {c, d} (the identity); component orbits; the maximal
invariant subgraph.

`src/fibred/moves/reduce.test.ts` (7 tests):

- genus 2, the Anosov map on one handle: both pieces are offered. The complement is a twice-punctured torus, where g is
  the identity on c, d, and the algorithm ends at finite order;
- the twice-punctured torus of port note 17: the complement of the rose is a pair of pants, the stem s lifts around the
  new circle, and the algorithm ends at finite order;
- two handles swapped by g (at the ends of a strip e): the two handles form one orbit of period 2, the first-return map
  on a handle is the Anosov map, and the complement (a pair of pants) has finite order.

`src/fibred/algorithm.test.ts`: `classify` recognizes the three types, and the algorithm stops at a reduction.

### Later addition: a disconnected train track (efficient, but reducible)

When the algorithm ends with an efficient train-track map, the infinitesimal branches may still not join all gates at
some junction: the **gate graph** there (the gates as vertices, the infinitesimal branches as edges) is disconnected,
τ is disconnected there, and f is reducible (`moves/split-junctions.ts`).

- **Detection** (`disconnectedJunctions`): union–find on the switches of τ, joined by the infinitesimal branches (and,
  to be safe, by every turn taken by an image of g).
- **The move "split junctions"**: every such junction becomes one junction per component (each keeps the cyclic order
  of its strip ends; the infinitesimal branches of an embedded τ don't cross, so the junction disk can be cut between
  the components). g stays a graph map without any lifting: every turn of an image lies in one component, and a
  junction's image is the piece of its old image that contains Dg of its strip ends. The new graph is a regular
  neighbourhood of τ; its boundary words, as words in G₀ without the peripheral ones, are recorded as the reduction
  system. The user chooses a piece (a component with χ < 0, with its period under g), and g is replaced by its
  first-return map there, as for `reduce`.
- **Suggestions**: at the end (after the closed-surface step, before declaring the map pseudo-Anosov) this is a step
  of its own, "disconnected train track", with the reduction system in the text and one option per piece, each with
  the growth of g there (its component of τ is an invariant filling train track, so g is pseudo-Anosov on it when
  λ > 1), plus "Ignore and finish". Before the end it is offered greyed out in every suggestion whenever some gate
  graph is disconnected (the official algorithm does it only at the end). The autopilot and "Run to the end" stop at
  it.
- Example: "Swapped handles" now ends here: τ splits at v₀ into {a B A b} and {c D C d}, the reduction system is
  a b A B, c d C D, and on each of the two pieces (swapped by g, period 2) g² is pseudo-Anosov with λ = 2.618034.
