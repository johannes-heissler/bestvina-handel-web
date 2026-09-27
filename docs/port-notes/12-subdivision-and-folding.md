# 12 — Subdivision and folding

**C# source:** `FibredSurfaceFoldingInitialSegments.cs` (348 lines: `SplitEdge`, `FoldInitialSegmentInSteps`,
`FoldEdgesInSteps`, `ReplaceEdges`, `ReplaceVertices`), `MovementForFolding` in `FibredSurfaceMovingVertices.cs`,
`EdgePoint.cs`
**Target:** `src/fibred/edge-point.ts`, `src/fibred/moves/subdivide.ts`, `src/fibred/moves/fold.ts`
**Status:** 🔍 ported. 🔍 **One case is not supported yet** (see Q1).

## What the C# code does

**Subdividing** (`SplitEdge`) a strip e at a point between two letters of g(e) creates a junction w, the parts e₁, e₂
with g(e₁) = the first letters and g(e₂) = the rest, and replaces e by e₁ e₂ in all images. Tracked `EdgePoint`s are
updated (their index shifts by the number of earlier letters e). The parts are named `a1`/`a2`, `a1-`/`a1+` or
`a2`/`a3`.

**Folding initial segments** (`FoldInitialSegmentInSteps`): strips at a junction whose images share the first i letters
are subdivided after i letters (unless their image has exactly i letters), then `FoldEdgesInSteps` folds the
initial segments into one:

1. It computes `MovementForFolding` options: for each strip p and each l, move the targets of all segments so that
   their side-crossing words (read from the _curves_) agree with the first l side crossings of p. The options are
   rated by the total number of side crossings afterwards ("badness") plus tie-breakers, and offered to the user.
2. It moves the junctions along curves (`MoveJunction`), renames and recolours the remaining strip, and builds the
   star of the merged junction (`StarAtFoldedVertex`) and new order indices.
3. `ReplaceEdges` replaces the folded strips by the remaining one in all images; `ReplaceVertices` merges the
   targets.

## The port

**`subdivide(fs, e, gIndex, muIndex = 0)`**: as in C#, with the μ update from the thesis: μ(e) = μ(e₁) | μ(e₂) split
after `muIndex` letters (any split is allowed; 0 puts w before the first side crossing). e₁ keeps the `Edge` object.
The parts keep the positions of e in the cyclic orders. It returns a `transform` for tracked edge points.

**`foldPair(fs, a, b)`** folds the strip b into its neighbour a (both from the same junction, g(a) = g(b), μ(a) = μ(b),
t(a) ≠ t(b)). The ends at t(b) move to t(a) as one block next to ā: before ā if b = σ(a), after ā if a = σ(b). That is
the cyclic order of the walk around the folded pair, and it replaces `StarAtFoldedVertex` and the order indices.
**`foldEdges`** folds a block of adjacent strips into the kept one, neighbour by neighbour.

**`foldInitialSegments(fs, edges, i, { c, kept })`**, and the key simplification for μ:

- Subdividing a strip and then moving the new valence-2 junction along a path lets the folded initial segment have
  **any** μ-image c starting at μ(v). So the choice of `MovementForFolding` (preferred strip p, number l of kept side
  crossings) is just **c = the first l letters of μ(p)**. The subdivided strips are split with an empty μ at v,
  and the new junction is moved along c.
- A strip folded completely (image of length i) keeps its μ, so its target junction is moved along μ(e)⁻¹ c. That also
  changes the other strips at that junction. This is the cost that the rating measures.
- These are exactly the partial-partial, partial-full and full-full cases of the thesis section "Folding and isotopy".
  The default c, the longest common prefix of the μ-images, is the thesis's choice for partial-partial folds and needs
  no isotopy of existing junctions.
- The split points are followed through the subdivisions: each subdivision lengthens the images of the other strips
  (the C# `updateEdgePoints` does the same).

**`foldOptions(fs, edges, i)`** lists all prefixes c of the μ-images, each **evaluated on a copy** of the surface: the
total length of μ after the fold (the C# badness), then a preference for strips in the middle of the block, as in C#.
Options that can't be carried out (see Q1) are left out.

**Point tracking:** `EdgePoint` (strip end + index into its g-image) gets `reversed`, `normalized`, `equals`, `vertex`,
`image`, `dgBefore`, `dgAfter`, `describe`. Moves return a `transform` for forward-normalized points. The inefficiency
removal (next module) needs this to follow an inefficiency through the folds.

### Not ported

- Renaming and recolouring the remaining strip after a fold (cosmetic; C# renames strips whose name doesn't end with a
  letter, and gives subdivided strips a new colour). This will come with the suggestion system, so that the UI can
  show it.
- The C# tie-breakers "fewer strips at the target" and "name ends with a letter". The rating now only uses the number of side
  crossings and the position in the block.

## 🔍 Q1: folding a loop completely

If a strip that is folded completely is a loop at v, and its μ-image isn't c, then moving its target also moves its
source, and so the other segments. The thesis mentions this case ("if one of the edges is a loop, then isotoping its
target changes also the initial segment of μ(a) and μ(b)"). The port throws an error for it, and `foldOptions` skips
such choices, so there's always the option c = μ(loop) if the loop is the preferred strip. The C# code didn't handle this
case either (it moved curves, which wasn't correct for μ). _Is that restriction acceptable for now, or do you know
a good general rule for this case?_

**Answer (2026-09-27): don't forbid it, compute the vertex move.** `foldInitialSegments` takes an optional `move`: a path γ in G₀
along which v is moved first (`isotopeJunction`). That conjugates the loop's μ to γ̄ μ(e) γ and puts γ̄ in front of the other strips
at v; c is then the loop's new μ-image. `foldOptions` tries every γ that is a prefix of the μ-image of a strip at v and rates
each option by μ's length afterwards, like the other options (γ = ∅ first on ties). `FoldOption.move` and `FoldRef.move`
carry the choice; the suggestion label says "Move the junction along γ".

## Tests

`src/fibred/moves/fold.test.ts` (11 tests), on the torus rose with g(a) = a b, g(b) = a b b:

- **subdivision:** images, junction image, both μ splits, following edge points, the C# naming, keeping the periphery;
- **cyclic order** of the strips to fold;
- **fold options:** only c = μ(a) works for the full loop a; its rating is 3;
- **partial-full fold of a and b:** gives a ↦ a a b₂, b₂ ↦ a b₂ with μ(b₂) = A b (growth φ² as before);
- **partial-partial fold** with the default c;
- **folding the backward ends A and B** for every offered option. The rating always equals μ's length afterwards,
  and each result passes the integrity check;
- rejecting strips that don't start with the same letters, or whose images differ.

All results pass `checkIntegrity()`. Its check that μ preserves the boundary words is what confirms the cyclic order
at the merged junctions.
