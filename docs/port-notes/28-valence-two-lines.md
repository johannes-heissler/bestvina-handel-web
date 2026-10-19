# 28 — Valence-2 lines, merged right after the cut

**Source:** not in the C# code. Builds on the valence-2 move (port note 9) and the cut (port notes 15, 22, 26).
**Target:** `src/fibred/moves/valence.ts` (the line and its merge), `src/fibred/moves/cut-closed-surface.ts` (the
cut), `src/fibred/suggestions.ts` and `src/fibred/move.ts` (the options, only with Q2)
**Status:** ✍️ note awaiting review

## The problem

After the cut along a singular leaf, most junctions have valence 2: the switches that the slits leave along the
branches of τ. In "Closed genus 2" (`closedGenus2OneCusp`):

| cut at | junctions | of valence 2 | lines (junctions each) | steps of `runAlgorithm` afterwards                         |
| ------ | --------- | ------------ | ---------------------- | ---------------------------------------------------------- |
| p      | 23        | 17           | 10, 5, 2               | 4: collapse, move vertices ×2, collapse                    |
| q      | 42        | 34           | 14, 10, 3, 3, 2, 2     | 40, starting with six rounds of collapse and move vertices |

The valence-2 junctions are only removed after all collapses and vertex moves, because the suggestion system tries
the invariant subforests and the vertex moves first (port note 18). These steps act on long chains of short strips,
so there are many of them, each with its narration.

**Experiment** (a scratch test): removing all valence-2 junctions right after the cut, without stopping at invariant
subforests:

| cut at | after the removal      | steps afterwards | final λ  |
| ------ | ---------------------- | ---------------- | -------- |
| p      | 6 junctions, 9 strips  | 2                | 4.212077 |
| q      | 8 junctions, 12 strips | 32               | 4.212077 |

The same growth as before, with fewer steps. (The rest for q is the usual folding, which comes back with valence-2
junctions of its own; that isn't the cut's doing.) The shortcut (replace the puncture by a singularity) leaves only
one or two valence-2 junctions, each on its own.

## Definition

A **valence-2 line** is a maximal edge path e₁ e₂ … eₙ in G (n ≥ 2) whose inner junctions v₁, …, vₙ₋₁ all have
valence 2, and whose two ends u (start of e₁) and w (end of eₙ) don't (u = w is allowed). Every valence-2 junction
whose two strip ends aren't the ends of one loop lies on exactly one line. (A component that is a circle of
valence-2 junctions only would have no ends; the surfaces here never have one, since G carries the whole
fundamental group.)

## The mathematics

**Merging a line** into one strip k from u to w is the composition of the n − 1 valence-2 moves at v₁, …, vₙ₋₁ that
keep the same strip eₘ each time: the homotopy equivalence h collapses all eᵢ with i ≠ m (vᵢ goes to u if it comes
before eₘ, to w after it) and stretches eₘ over the whole line. So:

- g(k) = g(e₁) g(e₂) … g(eₙ) (not yet cancelled), then the eᵢ with i ≠ m are deleted from all images and eₘ is
  renamed to k (it stays the same `Edge` object, as in port note 9), and junctions mapped to an inner vᵢ are mapped
  to u or w;
- μ(k) = μ(e₁) … μ(eₙ), reduced;
- the cyclic order: k takes the place of e₁ at u and of ēₙ at w.

No new mathematics: it is the existing move, n − 1 times. The point is that it is **one step** (one narration, one
picture before and after) instead of n − 1 slides and merges.

**The kept strip.** `removeAllValenceTwoJunctions` computes the widths once and, at each junction, removes the
pre-peripheral strip, or else the wider one. The kept strip is always the same object with the same width, so what
survives on a line doesn't depend on the order: the **narrowest strip that isn't pre-peripheral** (the narrowest of all,
if all are). The line merge uses that rule directly. After the cut there is no periphery, so it is just the narrowest.

**Why the cut may do it.** The cut is already a composition of homotopy equivalences (cut, remove the circles,
contract the polygons outside Q). One more at the end doesn't change what the move means. (In the experiment, λ
went from 4.2282 to 4.2280 for p and stayed at 4.2921 for q.)

## Proposal

1. **`valenceTwoLines(fs)`** in `valence.ts`: the lines, each as its edge path (oriented from one end to the other).
2. **`mergeValenceTwoLine(fs, line, kept?)`**: merges the line as above, by calling `removeValenceTwoJunction`
   n − 1 times (quietly) with the kept strip; one narration step before:

   > Merge the valence-2 line e₁ e₂ … eₙ from u to w into one strip k (the narrowest, eₘ): its image is
   > g(e₁) … g(eₙ) = … (not yet cancelled), and the other strips disappear from all images.

   (The per-junction slides, which animate the isotopy, are not shown; the picture jumps from the line to the
   strip. See Q3.)

3. **At the end of the cut** (`cutClosedSurface`, after `finishRemarking`, so in the final model): merge **all** lines,
   one narration step for all of them together ("Merge the 3 valence-2 lines that the cut left: …, each into its
   narrowest strip"), then `tightenMarking`. No stop at invariant subforests: the algorithm collapses them next.
   Also in the shortcut (`replacePunctureBySingularity`), so that both routes end the same way (see Q1).
4. **Tests** (`valence.test.ts`, `cut-closed-surface.test.ts`):
   - `valenceTwoLines` on a torus with a strip subdivided twice: one line of three strips; a loop junction is no line.
   - `mergeValenceTwoLine` gives the same g, μ and cyclic order as removing the inner junctions one by one with the
     same kept strip, and passes `checkIntegrity()`.
   - After the cut at p and at q: no valence-2 junctions, integrity, the boundary words under μ, and `runAlgorithm`
     ends at λ ≈ 4.212077 (the existing expectations stay).

## Questions

**Q1.** Merge after the shortcut too? It leaves one or two valence-2 junctions, each its own line of two strips.
Recommendation: yes, for consistency; it costs one narration step.

**Q2.** Should the valence-2 suggestion use lines everywhere, not only after the cut? Its options would be "Remove all"
and one per **line** ("Merge e₁ … eₙ") instead of one per junction, and "Remove all" would narrate one step per line.
The order of the suggestions stays as it is (collapse and vertex moves first, as in Bestvina–Handel): elsewhere lines
are short, and the follow-up folds of an inefficiency need the valence-2 junctions they create (`pending` in
`suggestions.ts`). Recommendation: yes, but as a second step after the cut, and keep the per-junction choice of the
removed strip as a variant of a line of two strips.

**Q3.** The per-junction slides animate how the junctions move across the sides of the model. For a line of 14
junctions that is many crossings. Drop them in the line merge (recommended), or keep them as motions within the one
step?

**Q4.** The name of the merged strip: the name of the kept strip (recommended; it is the rule of port note 9 for
each single merge), or something like the name of the branch of τ when all pieces of the line are parts of one branch
(`y_2 y_3 y_4` → `y`)? After the cut, the lines mix pieces of different branches (the junction p_a joins y_2 and
p_α_2), so the second rule would rarely apply.
