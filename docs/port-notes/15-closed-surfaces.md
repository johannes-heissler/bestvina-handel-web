# 15 — Closed surfaces: cutting along a singular leaf

**Source:** not in the C# code. This is the thesis, § "Closed surfaces and cutting" (`8 RestOfAlg/50ClosedSurface.tex`),
which the author wrote to be easier to follow than the original paper.
**Target:** `src/fibred/moves/fill-puncture.ts` (the shortcut), `src/fibred/singular-leaves.ts` (stages 1–2 of the cutting)
**Status:** 🔍 **implemented as a shortcut** (see below; the author's confirmation of the equivalence is pending). Stages 1–2 of the cutting are implemented too; stages 3–5 are on hold.

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
