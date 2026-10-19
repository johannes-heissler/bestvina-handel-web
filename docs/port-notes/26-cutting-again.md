# 26 — Cutting again: an orbit of artificial punctures

**Source:** not in the C# code. The thesis mentions it at the very end of § "Closed surfaces and cutting" without
working it out (port note 15, former Q3).
**Target:** `src/fibred/moves/fill-puncture.ts` (detection, shortcut), `src/fibred/moves/cut-closed-surface.ts` (the cut),
`src/fibred/suggestions.ts`, `src/examples/models.ts` and `src/embedding/remark.ts` (the model)
**Status:** ✍️ note awaiting review

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
   subgraph", applied to the orbit). The growth argument of the lemma should carry over unchanged, but the thesis
   doesn't state it for an orbit. **To check.**
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

### 4. The model (`remark.ts`, `models.ts`) — the main work

After the first cut with |Q| ≥ 2, the model is the closed polygon with the points Q inside and the vertex filled in.
For the second cut:

- The mid model has the points P ∪ Q′, and the final one only Q′. The points P have to be **filled in**, as the
  vertex was in the first cut.
- Filling in a point removes **one** edge of G₀ per point (a wall, see below). The other chords at that point stay,
  ending at a point that is no longer a puncture. A model can't express that today: interior points are always
  punctures, and only the vertex can be filled in. So `PolygonModel` needs **filled points**, e.g.
  `points: { at: Point2; filled?: true }[]` or a separate list `filledPoints`, each with its wall. They are drawn as
  dots, like the filled vertex.
- `filling` in `remark.ts` assumes one wall at the vertex and finds it by comparing edge names with the final model.
  It must handle several walls, one per point of P, each replaced by the rest of that point's boundary word.
- `remarkClosedSurface` accepts today only a closed polygon without points. It must accept a closed polygon with
  points (all of them artificial, i.e. `fs.isClosed`).
- **The alternative** would be to recompute the cells for Q′ alone (other chords, another G₀) and read μ off the drawing
  again. The pictures would be tidier (no filled points piling up), but μ would no longer follow from the old one by
  a homotopy equivalence, and the names of the chords would change. I'd go with filled points.
- The "contracts" case (|Q′| = 1, q′ slides into a filled place) generalizes poorly. I'd keep it only for the vertex.

### 5. Finding an example — open

There is no example yet that needs a second cut with |Q| ≥ 2. A first search (2026-10-19) found none:

- "Closed genus 2": one cut, then pseudo-Anosov with 4 cusps at the single new puncture.
- "Point push": marked closed, one cut, then reducible (as expected).
- 40 random genus-2 classes (10 Dehn twists each): none even ends with one cusp at its puncture (cusps 2–8 when
  pseudo-Anosov), so none needs a first cut.

Examples have to be constructed or searched for more specifically (e.g. maps built to fix a 1-prong, or the
pieces after a reduction). Without one, items 2–4 can only be tested on constructed cases.

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

1. Does the growth argument of the Lemma "Removing an almost peripheral subgraph" hold for an orbit of circles (math § 3)?
2. Filled points in the model (§ 4), or recompute the cells and re-read μ?
3. Should the wrong classification (pseudo-Anosov with 1-prongs at an orbit of artificial punctures) be fixed first, on
   its own? A minimal fix: detect it and say "τ has one cusp at each of the artificial punctures; cutting again is not
   implemented yet", instead of claiming pseudo-Anosov.
4. "Mark as closed" for "All punctures inside" with a single interior point (port note 24 currently falls back to the
   ribbon model): the vertex is already filled there, so the model can stay **unchanged** and only `fs.isClosed` is set.
   The cut then needs § 4 (an artificial interior point is filled in), but the marking itself does not. Take this
   correction into note 24 now?

## Tests

- Detection: an orbit of k ≥ 2 one-cusp punctures with `isClosed` gives the closed-surface suggestion, not "finished".
- The cut on such an example: all boundary words become circles at the same length of L, the result passes
  `checkIntegrity`, the growth drops, and the algorithm continues.
- The shortcut gives the same classification.
- The model: the filled points are drawn, μ is valid (`checkContinuity`), and the timeline draws every state.
