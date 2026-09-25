# 17 — Absorbing into the periphery

**C# source:** `FibredSurfaceAbsorbingIntoPeriphery.cs` (623 lines); the thesis, § "Absorbing into the periphery"
**Target:** `src/fibred/moves/absorb-periphery.ts` (`needsAbsorbing`, `absorbIntoPeriphery`), step "absorb into periphery"
in `src/fibred/algorithm.ts`
**Status:** 🔍 ported with a new formalism (combinatorial positions instead of curves and float indices)

## What the move does

The peripheral subgraph P is a union of circles, one around each marked puncture. Strips leaving P can wind around a
circle under g (g(s) = … s p p … for a stem s). Afterwards:

- P is **maximal**: no invariant subgraph Q ⊋ P deformation retracts to P;
- every strip leaving P maps to a path that **starts outside P**. So the turns between P and the rest of G never become
  illegal because of P;
- g acts on P as a **graph automorphism**;
- each junction on P has valence ≥ 3.

`needsAbsorbing(fs)` checks exactly these conditions. It is `false` if P is empty or not a union of circles.

## Understanding of the C# code

C# walked along the circle curves. It moved junctions to float positions along the peripheral edges, subdivided at those
positions, and rebuilt images from the shifted curves. That depended on the curves on the strips, which the port no longer
has (port note 05: the embedding is μ), and on float comparisons of positions.

## The port: positions on the universal cover of each annulus

1. **Q = P.** Collapse the forest Q ∖ P, where Q is the maximal invariant subgraph retracting to P
   (`maximalInvariantSubgraphRetractingTo`, port note 16), towards junctions on P.
2. **Circles.** The boundary words made only of P strips; their inverses run counterclockwise. At each junction of a
   circle, the strips leaving it are the part of the star between the two circle strips.
3. **Gates of G/P.** Dg_{G/P}(s) is the first letter of g(s) outside P. Two strips at a circle are in the same gate iff
   (Dg_{G/P})^N agree, with N = 2·#strips.
4. **Positions.** Unwrap the circle: the strip leaving junction k at rank r of m gets the position k + r/(m+1). The gates
   are intervals of the cyclic order. The order is cut open between two gates. With only one gate, it is cut before the
   strip that maximizes the signed length of the initial P piece of its image (the thesis's remark on this subtle case).
5. **New circle.** One new junction per gate at the position p(γ) of its first strip, and new circle strips between
   consecutive gate junctions.
6. **Images.** Each visit of an image to a circle, including an **empty** piece θ at a junction on P between two outside
   letters x, y, becomes a walk along the new circle:

   > from the gate of x̄ to the gate of y, with displacement p(γ_y) − p(γ_x̄) + (k_x̄ + T(θ) − k_y)

   Here T(θ) is the signed length of θ (counterclockwise +1) and k the old junction index. The last bracket is a multiple
   of the circle length: the laps. This is the thesis's −d(x̄) + T(θ) + d(y) with d(s) = p(γ) − pos(s). The leading and
   trailing P pieces of images of strips at P are dropped: the new gate junction is the image of the old one.
   Junctions outside P that g maps into P are moved to the closest gate junction (the unwrapped index nearest to it).

7. **g on the new circles** maps gate junction γ to the gate junction of Dg_{G/P}(γ), and circle strip to circle strip,
   which is an automorphism.
8. **μ.** A strip moved from junction k to its gate junction gets μ(circle path from the gate's junction to k) in front.
   The new circle strips get μ of the old circle path they replace.
9. **Graph.** The strips are reattached to the gate junctions with the star [circle strip clockwise, gate strips,
   circle strip counterclockwise]. The old circle is removed and the new one becomes P.

Everything in 4–8 is exact integer and rational arithmetic on positions. Nothing is geometric.

## Changes compared to C#

- **The empty-piece case:** a turn x y at a junction on P must also become a walk between the gate junctions of x̄ and
  y. The first version of the port missed this. The test "collapses a stem" catches it: g(a) = a b becomes a d b.
- The maximal Q is a fixpoint (port note 16), not a single pass.
- No curves and no float positions; the bookkeeping is on the universal cover of the annulus.

## In the algorithm

The C# priority: after valence-1 junctions, before finite order and reducibility.

## Tests

`src/fibred/moves/absorb-periphery.test.ts` (4 tests), on a twice-punctured torus (the rose a, b, a stem s and the
peripheral loop p around one puncture):

- g(s) = a b A B s p becomes g(s) = a b A B s. The integrity check passes before and after, `needsAbsorbing` becomes
  false, and the new circle is mapped to itself;
- the growth doesn't change;
- a collar twist with two strips at a two-junction circle: two gates, g(s) = a b A B s and g(t) = t b a B A, circle
  strips fixed;
- g(s) = s p: Q = P ∪ {s} is collapsed first. The four ends of a, b at the circle form three gates, so g(a) walks along
  the new circle between them.

`src/fibred/algorithm.test.ts`: the algorithm absorbs first and then stops at the reduction {a, b}. That reduction is
genuine, because the curve around the rose encloses both punctures.

## Observed

With `ignoreReducible`, that example makes "remove inefficiency" cycle with period 4, renaming a, b but not changing
the map. The inefficiency lies in g(s) and not in the stratum carrying λ, so folding doesn't lower λ. This is a known
limit of the absolute Bestvina–Handel algorithm on reducible maps. `runAlgorithm`'s step limit stops it. Reducing (16b)
is the proper way out.
