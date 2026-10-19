# 28 — Valence-2 lines, merged right after the cut

**Source:** not in the C# code. Builds on the valence-2 move (port note 9) and the cut (port notes 15, 22, 26).
**Target:** `src/fibred/moves/valence.ts` (the line and its merge), `src/fibred/moves/cut-closed-surface.ts` (the
cut), `src/fibred/suggestions.ts` and `src/fibred/move.ts` (the options, only with Q2)
**Status:** ✅ approved (2026-10-19, in the conversation)

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

## Decisions (author, 2026-10-19)

- **Q1** Merge after the shortcut too: yes. **Q2** Lines everywhere: yes. **Q3** No per-junction slides: yes.
  **Q4** The merged strip keeps the name of the kept strip: ok.
- The narration says briefly where each junction image that was at an inner junction of the line goes (one of the
  two ends).
- In the cut, the lines are merged **before** B is removed, so that B can be seen: it becomes a single loop. B is
  drawn in neon pink in the states where it is visible.

## Proposal (revised after the decisions)

1. **`valenceTwoLines(fs)`** in `valence.ts`: the lines, each with its strips e₁ … eₙ (oriented from u to w) and its
   inner junctions.
2. **`mergeValenceTwoLine(fs, line, kept?)`**: removes the inner junctions with `removeValenceTwoJunction`, quietly,
   from the kept strip eₘ outwards (vₘ₋₁, …, v₁, then vₘ, …, vₙ₋₁), removing the other strip each time. So vᵢ goes to
   u for i < m and to w for i ≥ m, as in the composition above. The name is the kept strip's (with the subdivision
   rule of port note 9, which the single merges apply). One narration step:

   > Merge the valence-2 line e₁ e₂ … eₙ from u to w into one strip k: its image is g(e₁) … g(eₙ) = … (not yet
   > cancelled), and the other strips disappear from all images. g(x): v₂ → u, g(y): v₅ → w.

   (the last sentence only if some junction is mapped to an inner junction). The kept strip by default: the narrowest
   that isn't pre-peripheral.

3. **The move.** A new move kind `merge valence-2 lines` with `lines?` (each line named by one of its inner junctions)
   and `kept?` (for a single line: the strip to keep). Without `lines`, all lines are merged one after the other,
   stopping when an invariant subforest appears (as the C# "remove all" does per junction). The suggestion "remove
   valence-2 junctions" offers "Merge all" and one option per line; the variants of a single line are its strips to
   keep. The old move kind `remove valence-2 junctions` stays for replaying saved sessions, but isn't suggested any
   more.
4. **The cut** (`cutClosedSurface`), in a new order after the cut itself:
   1. contract the polygons outside Q (`collapseUncut`, now before removing B; the shown intermediate states do this
      already). In both examples B stays a circle attached at one junction (of valence 4); this is checked, and if it
      fails, the cut falls back to the old order;
   2. merge all lines (one narration step for all of them, with the junction images as above, no stop at invariant
      subforests). Each B becomes a single loop at its attachment junction;
   3. remove the loops B (narrated as today, "Remove it … This fills in p"), drawn in neon pink in the states before
      steps 2 and 3;
   4. `finishRemarking` (fill in, slide), then merge the lines that are left (the attachment junction has valence 2
      after removing its loop).
5. **The shortcut** (`replacePunctureBySingularity`): merge all lines at the end.
6. **Saved sessions.** The cut and the shortcut now give other strips and names, so the moves saved after them would
   no longer apply. The file format goes to 5, and `FibredSurface.legacyCut` (set for files of version < 5) keeps the
   old cut and shortcut. _Dropped (author, 2026-10-19, with port note 29): no saved sessions with a cut are known, so
   the format stays 4 and the old cut is gone._
7. **Tests** (`valence.test.ts`, `cut-closed-surface.test.ts`, `session`):
   - `valenceTwoLines` on a torus with a strip subdivided twice: one line of three strips; a loop junction is no line.
   - `mergeValenceTwoLine` gives the same g, μ and cyclic order as removing the inner junctions one by one with the
     same kept strip, and passes `checkIntegrity()`.
   - After the cut at p and at q: no valence-2 junctions, integrity, the boundary words under μ, and `runAlgorithm`
     ends at λ ≈ 4.212077 (the existing expectations stay). The narration has a merge step with B pink in its state.
   - The existing session and timeline tests; the valence-2 part of the timeline test about slides goes (Q3).

## Implementation (2026-10-19)

Superseded in part by port note 29: the cut no longer blows up the junctions outside Q, so there is nothing to
contract before merging, and the fallback is gone.

As proposed. Results on "Closed genus 2": after the cut at p, B is a pink line of 23 strips (35 before contracting
the polygons outside Q), merged into the loop `c_1` at `p_o` and removed; removing it leaves `p_o` of valence 2, and the
last merge takes it out. The surface then has 6 junctions of valence 3, and `runAlgorithm` needs 2 steps (before: 4).
For the cut at q: 8 junctions, 32 steps (before: 40). Both end at λ ≈ 4.212077. The fallback to the old order (B not
attached at one junction after contracting) is not reached in the tests.

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
