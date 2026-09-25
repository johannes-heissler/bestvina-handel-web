# 15 — Closed surfaces: cutting along a singular leaf

**Source:** not in the C# code. This is the thesis, § "Closed surfaces and cutting" (`8 RestOfAlg/50ClosedSurface.tex`),
which the author wrote to be easier to follow than the original paper.
**Target:** `src/fibred/singular-leaves.ts`, `src/fibred/strands.ts`, `src/fibred/cut-along-leaf.ts`, `src/fibred/moves/cut-closed-surface.ts` (cutting); `src/fibred/moves/fill-puncture.ts` (shortcut)
**Status:** 🔍 **both routes implemented** and agreeing on the author's example: the thesis's cutting move (`cut-closed-surface.ts`) and the shortcut (`fill-puncture.ts`).

## The problem

For a closed surface Σ, the algorithm runs on S = Σ ∖ {p}. If it ends with a filling train track τ whose boundary word at p
has **only one cusp**, filling p back in gives a singularity of angle π, which a pseudo-Anosov structure doesn't allow. Then
(Lemma "oneCusp") exactly one gate has more than one strip, it has exactly two strips a and b, and one of g(a), g(b) is a strict
initial segment of the other. Folding them only reproduces the situation.

The author's example `closedGenus2OneCusp` (genus 2, λ ≈ 4.3152) is exactly this case: g is already efficient, every junction
has an infinitesimal triangle, and the puncture has one cusp (tested in port note 14).

## The move, as a combinatorial algorithm

1. **The geometry of TS(τ) at the switches** ✅. The height intervals of the branch ends on the singular arc of each switch:
   real branches bottom to top on one side, infinitesimal ones on the other. Height y on a branch at one end corresponds to
   w − y at the other end (the rectangle of ē is that of e rotated by 180°).
2. **Prongs** ✅. The singular leaves starting at the singularities (one per cusp of each infinitesimal polygon), traced as train
   paths with the width position in each branch. f maps prongs to prongs, and f⁻¹ of a prong is an initial segment of another
   prong (λ times shorter). So the preimages f⁻ʲ[L] needed for the cut are **initial segments of the preimage prongs**; they
   don't have to be computed by pulling paths back.
3. **Positions of the image strands.** To define the new carrying map after a cut, we need to know where the image f(R_e′) of each
   rectangle lies inside each branch it crosses: an interval of width w(e′)/λ. Their order within a branch is the
   **strand order**, the same problem as ordering side crossings in the embedding layer ([design/embedding.md](../design/embedding.md)).
   I'd implement it once, generically, for a combinatorial map into a ribbon graph (here g_τ, there μ).
4. **Unzipping along L and its preimages** (the move "Cutting along a singular leaf"): split each branch along the path at the leaf's
   width position into two branches of widths y and w − y, moving the cusp along. The new carrying map g′ follows from the strand
   positions. The preimages f⁻¹[L], …, f^{-(kl−1)}[L] are cut as well, so that g′ is well-defined.
5. **Removing the almost-peripheral circle** (Lemma "Removing an almost peripheral subgraph"): after the cut, the boundary word B of p
   is a circle attached at one vertex with g(B) = α B ᾱ. Delete B, removing its appearances from the images (the version with
   the isotopy into the junction v). The growth drops strictly, and the algorithm continues on the new graph, whose new punctures
   are the orbit of q.

## What stages 1–2 provide

- `switchArc(tt, s)`: the intervals of both sides of a switch's arc. Both sides stack to the same total width (the switch
  equation).
- `prongs(tt)`: one prong per cusp of each infinitesimal polygon (15 in the example: 5 triangles).
- `traceLeaf(tt, prong, n)`: the train path of the first n real branches with the width positions, stopping (`singular`) if the leaf
  runs exactly into a corner (a saddle connection).
- `imageProng(tt, prong)`: the prong between the images of the two infinitesimal branches.

**The test that confirms the conventions:** for all 15 prongs of the example, g_τ of the first three real branches of the prong
is exactly an initial part of the prong from the image singularity. If the heights, the 180° rotation or the cyclic orders at the
switches were wrong anywhere, this would fail.

## Decisions (2026-09-25)

- **Q1:** the user chooses q. The suggestion system will list the singularities sorted by their period
  (`polygonSingularities` already sorts them).
- **Q2:** the proposal (prolong, cut, check combinatorially; take the preimage leaf that first comes within the smallest
  infinitesimal width of the boundary) was accepted, for the case that the cutting is implemented.
- **Q3:** single puncture first; the detection (`hasOneCuspPuncture`) is written so it can be generalized.

## 🔍 The shortcut: fill in p directly

While preparing stages 3–5, a much shorter route to the same end result came up.

1. **Blow up the orbit Q of q.** As in the thesis (§ "The goal"), replace each junction of Q by its infinitesimal polygon: G₀
   has a junction per switch there, the polygon's infinitesimal branches as new strips, and g₀ is g with the infinitesimal
   branches inserted at the turns at Q (read off g_τ). This is a spine of Σ ∖ ({p} ∪ Q) with a train-track map for the
   same f̂ and the same growth λ.
2. **Fill in p.** Every infinitesimal branch ε of q's polygon has the polygon on one side and p's face on the other (p is the
   only real boundary word). So p's boundary word reads ε β. With p filled in, ε β bounds a disk, so ε ≃ β⁻¹ in Σ ∖ Q.
   Delete ε and replace it by β⁻¹ in all images: the homotopy equivalence G₀ → G₀ ∖ ε. The faces of p and q merge, and the
   result is a spine of Σ ∖ Q with a carrying map of the **same** f̂. No periphery is needed, since Q is a single orbit.
3. **Run the algorithm again.** It finds the efficient representative of f̂ on Σ ∖ Q. The thesis's cutting move shows that some
   representative on Σ ∖ Q has growth < λ. Since the efficient representative minimizes the growth among the carrying
   maps of the class, the growth also drops strictly on this route, and the end result is the same classification of
   the same mapping class on Σ ∖ Q.

**What we'd lose compared to the cutting:** the intermediate picture. The cutting keeps the half-translation structure (the
same f̂ and λ) until B is removed, which is nice to _visualize_. The shortcut reruns the algorithm from a non-efficient map.

**Question to the author:** do you agree that this is equivalent? If so, stages 3–5 are only needed for visualizing the cut,
and could wait.

**μ after the move:** the surface is punctured differently (Σ ∖ Q instead of Σ ∖ {p}), so μ is reset to the identity onto
a copy of the new graph. The embedding layer must therefore build a polygon model for an arbitrary reference spine G₀
(for example by collapsing a maximal tree into a rose). It needs that anyway for surfaces given by boundary words.

### Result on the example

For each of the 5 choices of q, the new graph is consistent (`checkIntegrity`), g preserves the boundary words, and
χ = 2 − 4 − |Q|. After running the algorithm again, **λ drops from ≈ 4.3152 to ≈ 4.2121**. The map is efficient, and the new
puncture is no π-singularity.

## Former open questions

**Q1: Which singularity q and which prong?** The thesis allows any vertex with at least 3 gates and an infinitesimal polygon, with the
periods k (g^k(v) = v) and l (g^{kl} doesn't rotate the polygon). My default would be a vertex with the smallest kl, since that means
the fewest preimage leaves to cut, and its first prong. Or should the user choose, as a suggestion with options?

**Q2: How long must L be?** The lemma that a long enough L makes the switches along B valence 2 is marked "Ideas" in the thesis
(density of the leaf is not proven). Proposal: prolong L one real branch at a time, cut, and **check combinatorially** whether B has
become a circle attached at one vertex; also use the thesis's refinement of choosing the preimage leaf L_i that first comes within
distance ε (the width of the smallest infinitesimal branch) of the boundary. With a maximum length as a safeguard against endless
loops, reporting through `reportInconsistency`.

**Q3: Several punctures.** The thesis's remark covers one pair a_i, b_i per puncture, when the move has to be applied again. I'd first
implement the case of a single puncture p, and give a clear error for several.

## Tests so far

`src/fibred/singular-leaves.test.ts` (4 tests), on the closed-surface example: the two sides of each arc stack to the same width, there are 15
prongs, every traced prong is a train path (real and infinitesimal branches alternating, width positions inside the branches), and f maps
prongs to prongs (the test above).

## Update (2026-09-25): both routes

The author's review of the shortcut: it is clever, but λ can rise first (it does: 4.48–13.18 on the example right after
filling in p), so the decrease of λ is only guaranteed by the argument of the cutting move, and it might not always apply.
Decision: **implement both.** The full trace of the shortcut is in [docs/examples/closed-genus-2.md](../examples/closed-genus-2.md).

### Answers to the questions about the shortcut

- **ε doesn't need to be fixed by g₀.** On the example it never is (the polygon at v2 is rotated, the others have period 2).
  Filling in p is the homotopy equivalence that collapses the disk of p through its free edge ε (ε ↦ β⁻¹); g₀ extends over
  that disk because g₀(B) is conjugate to B. Exactly the faces of p and q merge; all other polygons stay.
- **Where the shortcut can fail:** with several genuine punctures, the other side of ε may be a different puncture. Only
  polygon branches that border p may be used then.

### The cutting move, implemented

1. **Positions of the image strands** (`strands.ts`): f maps the arc of each switch s to the arc of g_τ(s) by h ↦ c_s + h/λ.
   The offsets c_s come from the prong corners (which f maps to prong corners), propagated along the branches. The lower edge
   of each image strip is then traced like a leaf. Checked: every strand runs along g_τ of its branch, and the strands tile
   every branch without gaps.
2. **The slits** (`cut-along-leaf.ts`): L through n real branches (ending on the arc right after a real branch), and
   f⁻ʲ[L] = the preimage prong traced to length ℓ(L)/λʲ, for j < P, the period of the prong.
3. **The cut:** subdivide the real branches where preimage slits end, split the pieces at the slit heights, and split each
   switch arc where both sides are cut. g′ follows the image strands. **One subtlety:** heights are measured from the bottom
   of the arc where a traversal starts. For infinitesimal branches (which leave a switch to the left) that is the
   rectangle's top, so the image is flipped when exactly one of source and target branch is infinitesimal.
   Checked for every prong and n = 1, 2, 3: g′ is continuous, the switch equation holds at every new switch, and **the growth
   of g′ is exactly λ** (the cut doesn't change f).
4. **Prolonging L** (Q2): n is increased until the boundary word of p is a circle attached at a single switch; the candidate
   prongs are tried in turn (`cutClosedSurface`).
5. **Removing B** (Lemma "Removing an almost peripheral subgraph"): B's branches are deleted from all images, and B is
   contracted into its attachment switch.
6. **Filling the other singularities (new).** The infinitesimal polygons of the singularities that were not cut bound
   **disks**, not punctures, so τ′ ∖ B is not yet a spine of Σ ∖ Q (on the example χ was −7 instead of −3). Each such disk
   is filled in by deleting one polygon branch ε, replaced by the rest of the polygon reversed. The thesis leaves this step
   implicit.

### Results on the example

| q      | L                                    | after removing B | after the algorithm                |
| ------ | ------------------------------------ | ---------------- | ---------------------------------- |
| v2     | 16 real branches                     | λ = 4.2282       | λ = 4.2121 (4 junctions, 7 strips) |
| v3     | 18 real branches                     | λ = 4.2921       | λ = 4.2121 (3 junctions, 7 strips) |
| v4     | 18 real branches                     | λ = 4.2921       | λ = 4.2121 (3 junctions, 7 strips) |
| v0, v1 | no cut found within 30 real branches |                  |                                    |

- **With the cutting, λ drops right away** (below 4.3152 directly after removing B), as the Lemma says. With the shortcut it
  first rises.
- **Both routes end at the same λ ≈ 4.2121**, for every choice.
- For v0 and v1, the number of switches of valence > 2 along p's boundary plateaus (at 7–9) within 30 branches. That is where the
  thesis's refinement (take the preimage leaf that first comes within the smallest infinitesimal width of the boundary) or
  longer leaves would be needed. Not implemented yet.

## Update: prolonging further, filling the polygons, performance

- **Uncut polygons are junctions again** (confirmed by the author: the thesis treats them as junctions implicitly; a slip
  in its last section). After deleting one branch of such a polygon, the rest of the polygon is collapsed, so the original
  junction comes back.
- **The search** (`cutOptions`): each candidate prong is traced once to find where it first comes within ε (the narrowest
  infinitesimal width) of p's boundary. From one lap before that point to three laps after it, cuts are tried (a lap is the
  length of p's boundary word). The options are sorted by the length of L. `circleDefects` gives the switches along p that
  still have valence > 2, for showing the progress in the UI.
- **All five singularities work.** The prongs of v0 and v1 first come within ε after 175 to 425 real branches, and the cut succeeds
  about one lap later (190 branches):

  | q      | shortest L   | time (search, cut, algorithm) | result                             |
  | ------ | ------------ | ----------------------------- | ---------------------------------- |
  | v2     | 16 branches  | 0.2 s                         | λ ≈ 4.2121, 4 junctions, 7 strips  |
  | v3, v4 | 18 branches  | 2.3 s                         | λ ≈ 4.2121, 3 junctions, 7 strips  |
  | v0, v1 | 190 branches | 7–8 s                         | λ ≈ 4.2121, 7 junctions, 11 strips |

- **A bug found by the large cuts:** `subdivide` read the image of the new junction after changing the graph. That is wrong
  when the split letter is the subdivided strip itself, reversed. Fixed, with a regression test.
- **Performance.** After the cut at v0, the graph has 673 junctions, and the algorithm took about 150 s. Three fixes brought it to about
  1.5 s:
  1. the Perron–Frobenius widths for choosing the strip to remove at valence-2 junctions are computed once per batch, instead of
     once per junction (that was 136 s);
  2. `invariantSubforests` computes the orbits per strongly connected component of the relation "f occurs in g(e)" instead of
     per edge, and stops building an orbit as soon as it can't be a forest (30 s → milliseconds);
  3. the algorithm collapses all maximal invariant subforests at once when their union is still a periphery-friendly forest
     (197 steps → 18).
