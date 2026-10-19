# 26 — Cutting again: an orbit of artificial punctures

**Source:** not in the C# code. The thesis mentions it at the very end of § "Closed surfaces and cutting" without
working it out (port note 15, former Q3).
**Target:** `src/fibred/moves/fill-puncture.ts` (detection, shortcut), `src/fibred/moves/cut-closed-surface.ts` (the cut),
`src/fibred/suggestions.ts`, `src/examples/models.ts` and `src/embedding/remark.ts` (the model)
**Status:** 🔍 implemented (2026-10-19), decisions in the conversation; see § Implementation

## The situation

The first cut replaces the artificial puncture p by the orbit Q = {q₁, …, q_k} of a singularity. The algorithm then
continues on Σ ∖ Q. The points of Q are artificial too: we still want the class of f on the closed surface Σ. So the
algorithm can end again with a train track whose boundary word at each qᵢ has **exactly one cusp**. Since f permutes
Q, if one of them has one cusp, all of them do. Then the cut has to be applied again, now with the k punctures
P = {p₁, …, p_k} (the former Q) in place of the single p, along a leaf from a new singular orbit Q′.

Starting with several artificial punctures is not considered (it doesn't make sense as a starting point). So P is
always a single orbit, and there is no periphery: the boundary words of τ are those of P and the infinitesimal
polygons.

## The mathematics

1. **The cut set stays invariant.** The slits are L and its preimages f⁻ʲ[L], j < (period of the prong); that is what
   makes g′ well defined (f⁻¹ of the cut set lies in the cut set).
2. **All boundaries become circles at once.** Once the cut separates a thin ring along the whole boundary B₁ of p₁,
   f⁻¹ of that ring is a thin ring along B₀ = f⁻¹(B₁) whose sides lie in f⁻¹(cut set) ⊂ cut set. So the cut
   separates rings along all Bᵢ as soon as it does along one. L itself needs to come close to one Bᵢ only, as
   today, but the check has to cover all of them.
3. **Removing the circles.** g′(Bᵢ) = αᵢ Bᵢ₊₁ ᾱᵢ. Filling in all of P, each Bᵢ bounds a disk, so deleting all of them
   from the graph and from all images at once is a homotopy equivalence (Lemma "Removing an almost peripheral
   subgraph", applied to the orbit). The growth argument carries over (author, 2026-10-19): as in the thesis and
   in Bestvina–Handel, each circle is glued into a long line with a valence-1 vertex at its end, and pulling tight
   lowers the growth. (Not by "a principal submatrix has smaller growth", which isn't true in general.)
4. The leaf L starts at a singularity of the new orbit Q′ (at least 3 prongs), never at a point of P (a 1-prong).

## What exists today

- **A single fixed singularity (|Q| = 1) already works.** The remarking slides q into the polygon's vertex ("contracts"),
  so the result is drawn in the original closed polygon, with q as its artificial vertex. A second cut is then
  exactly the first situation again.
- **|Q| ≥ 2 is wrongly classified.** `hasOneCuspPuncture` requires exactly one real boundary word. With k ≥ 2
  punctures that each have one cusp, the closed-surface suggestion is not offered, and the finished suggestion claims
  "f is pseudo-Anosov", although filling in P leaves 1-prongs. This is a bug in its own right.

## Changes and difficulties

### 1. Detection (`fill-puncture.ts`, `suggestions.ts`) — easy

`hasOneCuspPuncture` becomes `oneCuspPunctures(fs, tt)`: no periphery, growth > 1, and every real boundary word has
exactly one cusp (one or more of them). The closed-surface suggestion uses it with `fs.isClosed`. "Mark as closed"
(port note 24) stays for a single puncture only.

The meaning of `fs.isClosed` is stated explicitly: **all punctures of the current surface are artificial**. It already
works that way: the flag stays set after the cut, when the punctures are Q.

### 2. The cut (`cut-closed-surface.ts`) — moderate

- `punctureWord` returns exactly one word today. It becomes `punctureWords`: the boundary words with a real branch and
  no slit side, which must be as many as P has points.
- `attachmentSwitch` is checked for every word. `circleDefects` collects the defects of all of them.
- `cutOptions`: the ε-criterion for the first approach to the boundary already looks at every real branch, and `lap`
  already sums all real boundary words. Only the success check changes (all words are circles). By § 2 of the
  mathematics they become circles together; if that ever fails, the search simply continues.
- `removeAlmostPeripheralCircle` removes all circles **at once** (one substitution for all images, and the inner
  switches of every Bᵢ mapped to its attachment switch). One at a time would be wrong in between, since g maps the
  switches of Bᵢ into Bᵢ₊₁.
- Narration: "the boundaries of p₁, …, p_k are now circles …".

### 3. The shortcut (`fill-puncture.ts`) — moderate

Per point pᵢ, one polygon branch ε of Q′ whose other side is pᵢ's face is deleted, with ε ↦ (the rest of pᵢ's boundary)⁻¹.
Each deletion has to merge two different faces. The choice is made one at a time, re-reading the boundary words after
each deletion. Port note 15 already noted that only branches bordering the puncture to be filled may be used.

### 4. The model (`remark.ts`) — with the mechanism of port note 27

After the first cut, port note 27 slides one point of Q into the vertex, so the model is the compact polygon with
`closed: false`, the vertex is a puncture (artificial, since `fs.isClosed`), and the other points of Q are inside, with
explicit cells. For the second cut, P is the vertex and these points. Filling in works for any point the same way
(decided 2026-10-19):

- **Filling in a point p** deletes one edge of G₀ on p's face: its chord, from p to a neighbour x, becomes a wall, and
  p's face merges with x's (wall ↦ the rest of p's boundary word, in μ).
- **Contracting the wall:** an interior p moves to x and disappears (its other chords now end at x); the vertex can't
  move, so x slides into it (port note 27).
- **Several points at once:** one wall per point of P, chosen so that the merged faces form trees, each containing
  exactly one point of Q′ (outward from Q′ through the chord graph). The walls are then contracted along the trees.
- Then the degenerate cells are merged and the remaining points placed by the Tutte layout, as in port note 27. No
  filled points stay in the model.
- `remarkClosedSurface` must accept a polygon with points whose punctures are all artificial (`fs.isClosed`), and
  `filling` must handle several walls.

### 5. Finding an example — open

There is no example yet that needs a second cut with |Q| ≥ 2. A first search (2026-10-19) found none:

- "Closed genus 2": one cut, then pseudo-Anosov with 4 cusps at the single new puncture.
- "Point push": marked closed, one cut, then reducible (as expected).
- 40 random genus-2 classes (10 Dehn twists each): none even ends with one cusp at its puncture (cusps 2–8 when
  pseudo-Anosov), so none needs a first cut.

A second search found examples: random words in the four point pushes of "Point push as a composition", their inverses
and the Lickorish twists (in the strip names of the point push), marked closed and cut by the autopilot.

| word                                           | what happens                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| P_β̄⁻¹ P_γ⁻¹ P_α⁻¹ P_β̄ D_d⁻¹ P_α⁻¹ D_c₁⁻¹ D_a⁻¹ | after one cut, 2 punctures with one cusp each (λ 6.45 → 1.88 → 1.40 → …) |
| P_β̄ P_β̄ P_γ⁻¹ P_δ D_c₁ D_d D_c                 | after two cuts, 5 punctures with one cusp each                           |
| P_β̄ P_β̄⁻¹ D_d D_c₁⁻¹ D_b⁻¹ P_α D_c D_a⁻¹       | two cuts (the second with \|Q\| = 1), then reducible, finite order       |
| D_b⁻¹ D_d⁻¹ D_a⁻¹ D_d⁻¹ P_δ D_c₁ P_δ P_δ       | three cuts, then pseudo-Anosov with 4 cusps (18 minutes)                 |

Before this change, the first two ended with a wrong "pseudo-Anosov". The first is the test case
(`closed-surface-model.test.ts`). Cutting again can take many rounds: with the first word, P grows to 6 punctures
and then to an orbit of period 10, with the growth dropping each time.

### 6. Floating point

The preimage slits are λ^(period − 1) times shorter than L (`cutTooFine`). With an orbit P of length k, the prongs of
Q′ tend to have longer periods, so more cuts will be out of reach.

## Background: what "filled in" means, and why it removes a wall of G₀

G₀ is a spine of the **punctured** surface: Σ minus its punctures deformation-retracts onto it. For genus g with n
punctures, χ = 2 − 2g − n, so G₀ has rank 1 − χ = 2g + n − 1 (edges − vertices + 1).

A polygon model is a cell decomposition whose 0-cells are the punctures; G₀ is its dual graph (one vertex per cell, one
edge per cell side). The polygon's vertex counts as one 0-cell. Without interior points it is the only puncture: G₀ is
the rose with 2g petals (rank 2g, n = 1).

- **"closed: true" without points:** the vertex is an **artificial** puncture. It is still a puncture as far as G₀ is
  concerned (the algorithm needs one), so G₀ is the same rose. Only the geometry changes (compact instead of ideal).
  That is why "Mark as closed" keeps G₀ and μ (port note 24).
- **"closed: true" with points:** the vertex is **filled in**: it is no longer a puncture, and the surface is Σ minus
  the points. n drops by one, so G₀ must lose one edge. The cells stay as they are, but one chord at the vertex
  becomes a **wall**: it stays a side of its two cells, but its edge of G₀ is deleted, so strips no longer cross it.
  In μ, a crossing of the wall is replaced by going around the filled-in vertex instead: the rest β of the vertex's
  boundary word (wall ≃ β⁻¹, since wall · β now bounds a disk). That is a change of G₀, and μ changes with it, by a
  homotopy equivalence.

At the cut, the order is: first p is still a puncture and the points of Q are added (mid model, rank + k). Then p is
filled in: the wall goes, rank + k − 1, which is the rank for Σ ∖ Q. Filling in a point of P in the second cut is the
same step with an interior point in place of the vertex, hence the filled points of item 4.

## Open questions

1. ~~Does the growth argument of the Lemma hold for an orbit of circles?~~ Yes (math § 3).
2. ~~Filled points in the model, or recompute the cells and re-read μ?~~ Neither: walls only as an intermediate
   state, contracted as in port note 27 (§ 4).
3. ~~Fix the wrong classification first, on its own?~~ Fixed by implementing the move.
4. "Mark as closed" for "All punctures inside" with a single interior point (port note 24 currently falls back to the
   ribbon model): the vertex is already filled there, so the model can stay **unchanged** and only `fs.isClosed` is set.
   The cut then needs § 4 (an artificial interior point is filled in), but the marking itself does not. Take this
   correction into note 24 now?

## Implementation (2026-10-19)

- **Detection:** `oneCuspPunctures` counts the punctures if all have one cusp; the closed-surface suggestion appears
  for any number of them on a closed surface. "Mark as closed" stays for a single puncture.
- **The cut:** `punctureWords`, `attachedCircles` (all of P, checked together), `removeAlmostPeripheralCircles` (all at
  once). **The shortcut:** one polygon branch ε per puncture of P, each identified by its letter on that puncture's face.
- **The remarking** (`remark.ts`) accepts a polygon whose punctures are its vertex and its points (`fs.isClosed`):
  - **The mid model keeps the old cells:** each old cell with points of Q inside is cut into cells around them
    (`cellDecomposition` of that cell). The old chords keep their names, and a strip's crossings of them are the letters
    of its μ; only the new chords are read off the drawing. Recomputing all cells from the points gave crossings that
    don't come from an embedding.
  - **The walls** are chosen outward from Q, one per puncture of P (all polygon corners count as the vertex), and
    filled in from the outside in, each by the current boundary word of its child's face. The walled model keeps the
    mid cells explicitly; walls are chords without a name, and the filled-in points are drawn as dots (`filled`).
  - **Contracting** (`contractWalls`): each tree of walls collapses towards the vertex if it contains it, else towards
    its point of Q; a filled-in point moves into its neighbour, and a point of Q into the vertex.
  - **Checks:** the μ of τ read off the drawing must have a strand order (else the nudges are tried, then the move
    falls back to the ribbon model, as before).
- **Bugs found on the way:**
  - `spineOf` recorded the exits and sides before reversing edges (`reversed` in the naming), so with several cells an
    exit could leave the wrong cell. Invisible with one cell; it broke the first cut in the polygon for every point-push
    model with interior points in the mid model.
  - Reading the drawing: the stubs of the ports (a little beyond each port) could cross chords out of order; the pieces
    now end at their ports. A point of Q is placed at its junction when the centroid of the switches lies outside their
    polygon.
- **Still open:** the pictures of later cuts are crowded (hundreds of strips, junctions close to the polygon's sides),
  and in such a layout reading the drawing can fail, so the move falls back to the ribbon model. The search also hit
  integrity errors in the pieces after a reduction ("After absorb into periphery", "g can't be lifted to the complement
  of K", "After pull tight"), which have nothing to do with this move.

## Tests

- Detection: an orbit of k ≥ 2 one-cusp punctures with `isClosed` gives the closed-surface suggestion, not "finished".
- The cut on such an example: all boundary words become circles at the same length of L, the result passes
  `checkIntegrity`, the growth drops, and the algorithm continues.
- The shortcut gives the same classification.
- The model: the filled points are drawn, μ is valid (`checkContinuity`), and the timeline draws every state.
