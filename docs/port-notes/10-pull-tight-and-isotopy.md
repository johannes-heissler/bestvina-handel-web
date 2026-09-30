# 10 — Pulling tight, and moving junctions

**C# source:** `FibredSurfacePullingTight.cs` (202 lines), `FibredSurfaceMovingVertices.cs` (245 lines)
**Target:** `src/fibred/moves/pull-tight.ts`, `src/fibred/moves/isotopy.ts`
**Status:** 🔍 ported. `MovementForFolding` follows with the folding module.

## Pulling tight

g is not tight at two kinds of places:

- a **backtrack** x x̄ inside an image g(e);
- an **extremal junction** v: all images at v start with the same strip d, so g folds the neighbourhood of v into d.

Both are removed by a homotopy of g: delete the pair x x̄, or delete the common first letter(s) of all images at
v and move g(v) along them. For a loop at v the letters go at both ends. The graph and its embedding don't change,
so **μ stays the same**.

The C# code groups the loose places by the strip that g "turns back" on (the letter after a backtrack, the common first
letter at an extremal junction). The UI can tighten all of them, or only those at selected strips (one pair at a
time). `PullTightAll` loops "extremal junction first, otherwise a backtrack".

### Changes

- The C# bookkeeping of already tested `EdgePoint`s (`testedEdgePoints`, `AlignedIndex`, index updates after each
  removal; the comment notes 300 calls of `FirstOrDefault` and > 1 s for one `PullTightAll`) is gone. The port simply
  searches again after each step. The images are short, and each step shortens the total length, which also gives
  the termination bound.
- **The new junction image is set directly** to the end of the last removed letter. C# sets `vertex.image = null`
  and then takes the start of the new first letter of _some_ image; if all images at v became empty, g(v) stayed
  `null`.
- The shared prefix of the images at an extremal junction is computed with `sharedPrefixLength` instead of
  `Strip.SharedInitialSegment` (the duplicate noted in port note 01).
- Backtracks are plain `{ strip, index }` records. `EdgePoint` comes with the inefficiencies.

## Moving junctions

`MoveJunction` in C# is almost entirely curve geometry: shifted and concatenated curves, so that the moved
junction drags its strips along. Its combinatorial content is the isotopy from the design doc:

> **`isotopeJunction(fs, v, γ)`** moves v along a path γ in G₀: μ(e) ← γ̄ · μ(e) (cancelled at the junction) for each
> strip end e at v, and μ(v) ← t(γ). For a loop, μ(e) becomes γ̄ μ(e) γ. g doesn't change.

The rest of `FibredSurfaceMovingVertices.cs` is `MovementForFolding`: it chooses how to move the junctions
before a fold so that the side-crossing words (now μ) of the folded strips agree, and rates the choice by the total
number of side crossings afterwards ("badness"). It reads `Curve.SideCrossingWord` and moves curves. In the port
it becomes a computation on μ with `isotopeJunction`, as part of the folding module.

**Contracting a strip as an isotopy** (`slideAlong(fs, v, t)`): the moves that contract strips (collapsing a tree,
removing a junction of valence 1 or 2) first slide the junction v along the strip t that leaves it, one side of μ(t)
at a time (`moveJunction`, each crossing a narrated step with its motion for the timeline), until t crosses no side;
then t is contracted. A tree is contracted by sliding its junctions towards the centre, the nearest first. The result
for μ is the same as before (prolonging the other strips at v by μ(t̄), reduced), but the timeline now shows the
junctions moving across the sides instead of jumping.

Pulling tight narrates each step: which backtracking of which image is cancelled (a few letters around it), or which
common start is removed at an extremal junction. It changes g only, so it has no motion.

## Tests

`src/fibred/moves/pull-tight.test.ts` (9 tests): finding backtracks and extremal junctions and grouping them; pulling tight a
map with nested backtracks (`a b B b B A a b` → `a b`); pulling tight the conjugation by b (g(a) = b a B, g(b) = b b B)
to the identity, removing letters at both ends of loops; tightening only selected strips; μ staying unchanged; and
`isotopeJunction` conjugating μ of loops while keeping the boundary words (checked by `checkIntegrity`).

## Update: moving the image of a junction (a shortcut)

`moveJunctionImage(fs, v, a)` moves g(v) along a strip a leaving it (a homotopy of g; μ stays): every image of a strip
end at v loses an initial a, or gets ā in front, and g(v) becomes the end of a (for a loop, both ends change). Pulling
an extremal junction tight is the case where all images start with a. At a junction with a single gate (gatewise
extremal), moving g(v) along one of the strips a = Dg(e) can shorten the images enough to lower λ. The suggestions
shown in the UI (`SuggestionContext.shortcuts`, not the autopilot) add it as an option for every such v and a for which
λ, after pulling tight on a copy, is smaller, e.g. in BH 6.1 at step 6 "move the image of v along y: λ 3.2340 → 3.0000
after pulling tight". Tested: after each shortcut offered in BH 6.1, g is consistent and the algorithm ends with the
same λ.
