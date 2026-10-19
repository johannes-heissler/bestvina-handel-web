# 22 — Interior punctures, filled points, and cutting without losing the surface

**Source:** not in the C# code (which had interior punctures only as curves on the flat torus, dropped in the design doc).
**Target:** `src/geometry/cells.ts`, `src/examples/models.ts`, `src/embedding/chart.ts`, `src/render/svg.ts` (phases 1–2);
`src/fibred/moves/cut-closed-surface.ts`, `src/fibred/moves/fill-puncture.ts`, `src/embedding/remark.ts`,
`src/session/session.ts` (phase 3)
**Status:** 🔍 phases 1–3 implemented (phase 3 with the author's wall contraction, § 5)

## The goal

1. Polygon models may have **punctures inside the polygon** (marked with ×), in all geometries (ideal, compact, flat).
2. The polygon vertex of a closed polygon can be **filled in**: the surface is then Σ ∖ Q for the interior points Q.
3. After the closed-surface move (both routes), the surface stays drawn in **the original polygon**: p is filled in and
   the new punctures Q sit inside, instead of switching to the ribbon model of the new graph.

## 1. Cell decompositions

> A polygon model is a **cell decomposition** of Σ whose 0-cells are the punctures (and marked points); G₀ is its dual
> graph.

The polygon without interior points is one cell; its only 0-cell is the vertex class, and the dual is the rose. Interior
points are further 0-cells. The polygon is cut by **chords** (straight in Klein coordinates, so geodesics) between its
vertices and the points into convex cells:

- **regions** = cells, **ports** = cell sides (the middle part, as for polygon sides);
- every edge of G₀ is **glued**: polygon sides by the deck transformations, chords by the **identity**. The straightening
  of the layout (step 2′) then also pulls the strips straight through the chords.

Chart, layout and strand order need no change: they already handle several regions (ribbon, plane). μ(e) stays the word of
cell sides crossed.

**Construction** (`cellDecomposition`): a triangulation of the polygon with the points as extra vertices (insertion, then
Lawson flips towards Delaunay for well-shaped triangles), then cells are **merged greedily** across chords, longest first,
as long as the union stays convex. At a polygon vertex the union is always convex (its angle is at most the polygon's), so
only the angles at interior points are checked; an angle of exactly π is allowed. One point in the middle thus gives a
single diagonal through it: 2 cells, 2 chords. Every interior point keeps at least 2 chords, so no cell has a slit.

**Order and names:** the cells are ordered by their first side: polygon sides by index first. Each cell's star starts
with that side. Without interior points this is exactly the old rose (G₀ unchanged for all saved sessions). Chords get the
names s1, s2, … (not letters, which the strips of G use; changed on 2026-10-17, see § 7), lowercase leaving the earlier cell.

**Points** are given in chart coordinates: Klein coordinates for hyperbolic polygons (the regular polygon is centred at
0), the coordinates of `geometry.vertices` for flat ones.

## 2. Filled points

A closed polygon with interior points describes Σ ∖ Q: the vertex class p is an ordinary point. Its dual graph Ĝ is a spine
of Σ ∖ ({p} ∪ Q), one puncture too many. The fix is the same lemma the shortcut uses (§ 4):

> **G₀ = Ĝ ∖ ε₀** for the dual ε₀ of a chord from p to a point q of Q. That chord becomes a **wall** that no strand
> crosses (no port); the faces of p and q of Ĝ merge.

G₀ is a subgraph of Ĝ, so the chart is the same, minus one port. Words in G₀ are words in Ĝ that don't use ε₀, so the
strand order is unchanged. ε₀ is the first such chord in the order of the cells (deterministic, so the model alone
determines G₀).

Semantics of `PolygonModel.closed`:

| `closed` | interior points | the vertex class                     | the surface   | `isClosed` of the start |
| -------- | --------------- | ------------------------------------ | ------------- | ----------------------- |
| false    | any             | a puncture                           | Σ ∖ ({p} ∪ Q) | false                   |
| true     | none            | an artificial puncture (as before)   | Σ, via Σ ∖ p  | true                    |
| true     | some            | **filled in** (drawn as a small dot) | Σ ∖ Q         | false                   |

## 3. The cutting move without losing the surface (phase 3)

### What happens today

Before the cut, G is a spine of Σ ∖ p and μ maps into the rose. The cut builds τ′ out of **pieces** (`Piece` in
`cut-along-leaf.ts`: the sub-rectangles of the branches of τ, cut across where a slit ends and along at the slit heights),
removes the circle B around p and fills in the disks of the polygons that weren't cut. The result is a spine of Σ ∖ Q;
μ is reset and the session switches to `ribbonModelOf`.

G₀ can't simply be kept: τ′ lies in Σ ∖ p, but there the slits bound disks, so G₀ can't see the new faces.

### The key observation

The singularity q lies in a complementary face of τ, its infinitesimal polygon, which is a disk in Σ ∖ p. With a puncture q
put into that face, τ is a spine of Σ ∖ ({p} ∪ Q). Every piece of τ′ lies in a branch of τ, and every slit starts at a
corner of q's face. So everything can be computed on τ in the original chart with Q added, and only then cut. The face of
τ′ along a slit (along it, around its end, back, around q) maps to a conjugate of q's boundary word.

### Steps

1. **Positions of Q.** Each q at the centroid of the switch nodes of its infinitesimal polygon (`layout.switches`), from the
   layout with the default options. Checked to lie inside the polygon of switches. The positions are **stored in the move**,
   so G₀′ only depends on saved data.
2. **The new model.** The same polygon with the points Q (plus earlier interior points) and `closed: true`, so p is filled
   in (§ 2): G₀′ = Ĝ′ ∖ ε₀. Polygon sides are never split, so old side letters carry over; only chord letters are new.
3. **μ_τ : τ → Ĝ′ by intersection.** τ drawn from the layout: real branches as the strip polylines from switch node to switch
   node, infinitesimal branches as segments between switch nodes. μ_τ of a branch is the sequence of cell sides its polyline
   crosses, with the parameter of each crossing. A chord leaves q through exactly one infinitesimal branch of q's polygon,
   decided by its direction. Vertex images: the cell of each switch node.
   **Early check:** μ_τ maps every face of τ to a boundary word of Ĝ′ (q's polygon to q's word). This catches a layout that
   isn't an embedding before anything changes.
4. **μ on τ′.** A piece of a real branch e covering the length range [a, b] gets the crossings of e's polyline with parameter
   in [a/ℓ, b/ℓ]; pieces of infinitesimal branches the branch's word. Stacked pieces get the same word, pieces side by side
   split μ(e) at the same place. The split itself is arbitrary (moving it along the strip is an isotopy: there is no
   puncture in a strip); it only has to be consistent, and it is.
5. **Removing B and filling the disks:** unchanged; strips are only deleted (μ of the others stays), and the collapse of the
   remnants updates μ itself. Now G ⊂ Σ ∖ (Q ∪ {p}), and the face of one q also contains p (B was a thin ring between p and
   a slit).
6. **Filling p on the side of G₀:** substitute ε₀ ↦ β⁻¹ in μ (Ĝ′'s face of p reads ε₀ β) and reduce (§ 4).
7. **Tightening and checks.** Isotope junction clusters while μ gets shorter (as `tightenAtJunctions`), which removes most of
   the dependence on the layout and shortens the words of step 6. Then `checkIntegrity` (μ maps boundary words to boundary
   words of G₀′) and the topology. **If anything fails,** fall back to the current route (μ reset, ribbon model) with a
   message through `onError`.

**Layering:** the fibred move stays combinatorial and also returns piece → (branch, interval), Q and what was deleted;
`embedding/remark.ts` (new) does steps 1–3, 6, 7, since it needs the chart and the layout; the session takes the new model
from the move instead of from `ribbonModelOf`.

**Alternative considered:** a purely combinatorial μ′ (faces of the strand arrangement per cell, chords as shortest dual
paths). Layout-independent, but messy as soon as new chords cross old ones. Intersecting straight segments is uniform, and
the checks catch failures.

## 4. The other route, and why both fill p the same way

### The shortcut (`replacePunctureBySingularity`, port note 15)

The closed-surface problem: the algorithm runs on S = Σ ∖ p. If the efficient τ has only one cusp at p, filling p back in
would give a 1-pronged singularity, which a pseudo-Anosov doesn't have. Port note 15 implements two ways out:

- **The cut** (thesis): cut along a singular leaf from a singularity q until the boundary of p is a thin circle B attached
  at one switch, then remove B. Same f, same λ until B is removed; afterwards the growth drops.
- **The shortcut**:
  1. **Blow up the orbit Q** (`blowUpOrbit`): each junction of Q is replaced by its infinitesimal polygon. The new graph
     has a vertex per switch there and the polygon's infinitesimal branches as new strips; g₀ is g with the infinitesimal
     branches inserted at the turns at Q (read off g_τ). It is a spine of Σ ∖ ({p} ∪ Q) with a train-track map of the same
     f and λ; the polygons are its periphery.
  2. **Fill in p** (`fillPuncture`): an infinitesimal branch ε of q's polygon has the polygon on one side and p's face on
     the other, so p's boundary word reads ε β. With p filled in, ε β bounds a disk, so ε ≃ β⁻¹: delete ε and replace it
     by β⁻¹ in all images of g. The faces of p and q merge; the result is a spine of Σ ∖ Q carrying the same f.
  3. **Run the algorithm again** from this (no longer efficient) map. λ can rise first (4.48–13.18 on the example), but
     the end result is the efficient representative on Σ ∖ Q.

  Today μ is reset afterwards, as for the cut.

### The lemma behind ε, ε₀ and the disks

> **Filling a point.** Let Γ be a spine of S ∖ {p}, and let p's face read ε β, where the other side of the edge ε is a
> different face. Then Γ ∖ ε is a spine of S, and r : Γ → Γ ∖ ε, ε ↦ β⁻¹, is a homotopy equivalence of S: it sweeps ε
> across the disk of p onto the rest of its boundary. A map into Γ becomes r ∘ φ; a map out of Γ is restricted to Γ ∖ ε.

It is used three times, on different graphs:

| Where                    | Γ                                       | ε                                 | Faces that merge         | Applied to                                     |
| ------------------------ | --------------------------------------- | --------------------------------- | ------------------------ | ---------------------------------------------- |
| shortcut, `fillPuncture` | the blown-up G (source and target of g) | a branch of q's polygon next to p | p and q of G             | g: restricted, and ε ↦ β⁻¹ in its images       |
| cut, removing the disks  | τ′ ∖ B                                  | a branch of an uncut polygon      | a disk and its neighbour | g′ (the disk has no puncture: no face is lost) |
| step 6 above, and § 2    | Ĝ′ (the target of μ)                    | ε₀, dual to a chord from p to q   | p and q of Ĝ′            | μ: only ε₀ ↦ β⁻¹ in its images                 |

μ is a homotopy equivalence between **two** spines of the surface, G and G₀, and filling p changes the surface on both
ends. So p has to be filled in on both sides:

- **On the side of G:** the shortcut deletes ε (the strip ε of G is swept across p); the cut removes B (B is the boundary
  of p's disk, contracted into its switch). Either way G becomes a spine of Σ ∖ Q, and p's face of G merges with q's.
- **On the side of G₀:** both routes delete ε₀ (the wall s₀ dual to ε₀ is erased, and the strands that crossed it are swept
  across p, all together and in their order). Geometrically it is the same isotopy over the disk of p, seen from the
  reference instead of from G. G₀ becomes a spine of Σ ∖ Q, and p's face of Ĝ′ merges with q's.

The two deletions match: G's merged face around q ∪ p maps to (q's word)·(p's word) up to conjugation, and r₀ kills p's
word, so it maps to q's face of G₀′. Hence `checkIntegrity` holds again.

### Keeping the model on the shortcut too

The blown-up graph is τ near Q (junctions outside Q, switches at Q, strips and the infinitesimal branches at Q). So step 3
gives μ_blown : G_blown → Ĝ′ directly (strip polylines trimmed to the switch nodes at Q, polygon branches as segments
between switch nodes). Then both fillings: delete ε from G (restrict μ) and substitute ε₀ in μ. Steps 1, 2, 6, 7 are shared
with the cut; step 4 isn't needed.

## Phases

1. ✅ Interior punctures in polygon models from the start: `cellDecomposition`, spine, chart (cells, chord ports, identity
   gluing), × for punctures, chords drawn faintly, gallery models.
2. ✅ Filled points: `closed` with interior points; G₀ = Ĝ ∖ ε₀ with a wall.
3. ✅ The closed-surface moves keep the model (`embedding/remark.ts`, `fibred/remarking.ts`, session), narrated step by
   step (§ 5).

## Decisions taken while implementing (for review)

- **Merge criterion:** angles up to and including π at interior points (fewest cells); longest chords first.
- **ε₀:** the first chord from the vertex class to an interior point, in the order of the cells. A choice by fewest
  crossings (proposed earlier) would have to be stored in the model; not needed so far.
- **× for all punctures,** also in the plane (before: dots). A filled vertex is a small open dot at the corners.
- **Chords** are drawn as thin dashed lines; walls (ε₀) solid grey.
- **Gallery:** for genus ≥ 1 and p ≥ 1, the standard polygon with the extra punctures inside, and the closed polygon (compact,
  or the flat square for the torus) with all punctures inside. The points are placed automatically (the centre, or a small
  circle around it).

## Open questions

1. At the cut, positions of Q from the default layout, stored in the move (recommended)?
2. Should the user place interior points by clicking (later, together with point pushes)?
3. Should the cut track τ′ get its own view in the polygon (slits from × to their ends), or only the result?

## Tests

- `cells.test.ts`: no points → one cell; one point in the middle of the octagon → 2 cells (a diagonal through it); random
  points → convex cells, Euler characteristic, every point a corner of ≥ 2 cells, cells tile the polygon (areas add up);
  points outside or on the boundary throw.
- Models: topology with interior points, open and closed (filled); G₀ without points unchanged (names and stars);
  `spineOfGraph` after renaming.
- Chart: a port per oriented edge of G₀, chords glued by the identity, the wall has no port; layout without crossings and
  `checkIntegrity` after a few moves on a model with interior points.
- Phase 3: μ_τ passes the face check before the cut; after the cut G, g and names are identical to the current route; μ′
  passes `checkIntegrity`; replay gives the same G₀′ and μ′; a broken layout triggers the fallback.

## 5. Phase 3 as implemented (2026-10-17)

### The author's idea: contract the wall

After filling in p, the wall s₀ (the chord from p to q₁) is a slit from the ordinary point p to the puncture q₁. It can
be contracted: q₁ slides along it into p's corner. On G₀ this changes nothing combinatorially (the wall has no dual edge
any more), only the picture: the chords that ended at q₁ now end at the corner. For a single new puncture (|Q| = 1, a
fixed singularity) all chords then join corners of the polygon, and merging the cells across them deletes their letters
from μ. **So μ maps into the original rose again: the session keeps the original model and even the same G₀ object**,
and the puncture q is drawn at the vertex, where p was. This works the same for the shortcut, whose ε in τ merges the
faces of p and q exactly as ε₀ does in G₀.

For |Q| > 1 only one point can take p's place, and the others would need chords that are no longer straight; there the
result is the model `{ ...polygon, closed: true, points: Q }` (§ 2: p filled in, the wall kept).

**Superseded by port note 27:** for |Q| > 1 the other points move along (a Tutte layout), so the wall is contracted
in every case, as a step of its own after the walled state.

### Filling p on both sides at once

Filling p changes G (B removed, or ε deleted) and G₀ (the wall ε₀) together: `Remarking.filled` converts μ right after B
is removed (resp. ε deleted). Done later, the states in between would have G's faces of p and q merged while G₀ still
separates them, and they can't be drawn.

### What the code does

- `fibred/remarking.ts`: the interface the moves use (`part`, `cellAt`, `switchCell`, `junctionCell`, `toSwitch`,
  `filled`, `finish`), and `markTrack` / `markParts` for μ of τ and of the cut track. The moves stay combinatorial.
- `embedding/remark.ts`: the geometry. The points of Q go to the centroid of the switches of their infinitesimal polygons
  in the layout with the default options; if a switch or strip lies exactly on a chord (it happens: the Tutte layout
  averages, so switches can be collinear with two points of Q), the points are moved a little inside their polygons and
  the drawing is read again. The sides of the new G₀ keep the names and orientations of the old one. A registry
  (`modelOfSpine`) gives the model of each new G₀, for the session and the timeline.
- `MoveHooks.remark` (and `AutopilotOptions.remark`) pass the provider; the session gives it the model of the state.
  Without it (tests, scripts) the moves work as before (μ reset, ribbon model).
- **Checks:** `finish` requires `checkIntegrity` without μ problems and a strand order; otherwise the move falls back to
  resetting μ, with a message.

### Narration

Both moves now explain themselves (they are in `NARRATES_ITSELF`) with a state per step, so the timeline of "What will
happen" shows them in the polygon:

1. the introduction (why the move is needed) → G with only the junctions of Q blown up, Q marked ×, and the chords (§ 6);
2. L with its branches (as coloured strip names) and its preimages, then the cut **branch by branch** (at most 24 steps,
   each a valid cut of its own, so the track visibly splits);
3. removing B, which fills in p (with what happens to the picture) → the result.

The shortcut: blowing up Q → filling in p (both sides) → the result. The timeline draws states with a different G₀ each in
its own model, without interpolating (`drawTimeline`).

### Changes elsewhere

- **The preset "Closed genus 2" is drawn in its octagon** X y K a x A Y k: `FibredSurfaceOptions.graph` starts with a
  given graph G whose spanning tree (c, d, b, z) contracts to the rose of the polygon (`contractedWord`), μ mapping the
  tree to the vertex. This is the "polygon model for an arbitrary G₀" that note 15 asked for, for one-vertex-class graphs.
- **Drawing μ that isn't tight at a junction:** the strand order can't order strands that only part at a junction which
  could be pulled across a side. The views (and the remarking) then draw `withTightMarking(fs)`, a copy of μ isotoped
  until it is tight there. Before, such states silently weren't drawn (this also happened after the old cut).
- `tightenAtJunctions` crashed on a cluster without strips across a side; fixed.
- **μ is pulled tight at the junctions after every move** (`tightenMarking` in `fibred/moves/isotopy.ts`, moved there
  from `embedding/image.ts`; it is combinatorial): while all strips leaving a cluster of junctions start across the same
  side of G₀, the cluster is isotoped across it. G and g don't change. The cut needs it in every state: a slit splits a
  switch into parts that keep the switch's place, and a part can be left with only strips crossing one chord (in the
  closed genus-2 example, the corner v2c with a: s₂ a, b, Ε2: s₁, ε12: s₂ splits into v2e {a₁: s₂ a, ε12: s₂} and
  v2f). Such a junction was drawn on the chord, with its strips crossing. Collapsing an invariant forest left loose
  junctions too. The shown states of the cut and the shortcut are tightened as well.

### Deviations from § 3

- The positions of Q are **not stored in the move**; they are recomputed from the default layout on replay
  (deterministic). Only μ (the picture) depends on them, not g.
- Step 7 tightens only at the junctions (no shortening of μ beyond that).

### Known limitations

- The raw result of the cut has many parallel strips and valence-2 junctions (26 strips for v2; for the period-2 orbit
  of v1, whose leaf is long, over 500), until the algorithm's next steps remove them.
- Only a closed polygon without interior points is kept; other models (ribbon) fall back to the ribbon model as before.
- The user isn't asked which prong and how long L is: the move takes the first prong of the orbit with the shortest L.

## 6. Only Q is blown up (author's review, 2026-10-17)

The first version showed the whole train track τ during the cut and ended with a step "filling the disks of the
polygons that weren't cut". The author pointed out that this step only undoes something that should never have been
done: a junction outside Q has a polygon that bounds a disk without a puncture, so it should stay **one junction** (the
train-track view shows its polygon anyway). Only the junctions of Q are blown up, because the new punctures sit inside
their polygons, and G must be a spine of Σ ∖ ({p} ∪ Q): exactly the blow-up of the shortcut (`blowUpOrbit`).

Now:

- The cut still runs on all of τ (it needs the widths and heights of every branch), but **every state shown, and the
  result, has the infinitesimal branches at the junctions outside Q contracted** (`collapseUncut`): each polygon there
  loses one branch ε (homotopic to the rest reversed), and the rest, a forest, is collapsed. Where the slits split such a
  junction, the parts are numbered (v3, v3_2, …); the corners of the polygons of Q keep the names of their switches.
- So the first state of the cut is G blown up at Q only, the same graph as the shortcut's first state (tested), and the
  separate step about the disks is gone.
- The result is smaller: for v2, 26 strips instead of about 30, and no infinitesimal strips outside Q.
- **Drawing:** a junction of valence 2 no longer limits the strip widths (it is a point on a strip, with no gates to fit,
  and the cut creates many that lie right next to another strip; one of them shrank every strip to nothing).
- Without a provider (no polygon to keep), μ is reset after the contraction, as before.

## 7. Concrete explanations (author's review, 2026-10-17)

- **The choices of the cut** (under "Cut along a leaf from v…") name each leaf: "The leaf of length 16 from v2: a d x c D
  z k y …", with its preimage leaves under it ("f⁻¹(L) from v2: y Z A K Y b (the last partly); …").
- **The narration** uses the actual values instead of the theory: the introduction is two sentences; the first cutting
  step lists L and every preimage leaf (where it starts, its branches, whether it ends inside its last branch); each
  further step says which branches L and the preimages enter (a preimage is mentioned only when it reaches a new branch);
  the removal of B gives its length and first branches; filling in p names the wall chord and what replaces it in μ
  (e.g. "s1 ↦ X s2 a x k S3 y A K Y"). The shortcut names the branch ε and the path it becomes.
- **Chords are named s1, s2, …** instead of unused letters: in the texts, "the chord b" was confusing where b is also a
  strip of G (the closed genus-2 preset uses the letters of G for the octagon).
- **Names: one convention for indices.** Names are stored with an underscore, which can be typed, and shown with
  subscripts, like LaTeX without braces (`displayName`: "y_2" → y₂, in the texts, the tables and the pictures). Lookups
  use the stored form (`canonicalName`, `nameKey`), so a subscript typed or stored in an older session ("a₁") finds
  "a_1", and free names are checked in that form. Applied to: the initial segment of a fold (a_1), the peripheral
  circles beyond the Greek letters (γ_1), the switches of τ (v2_1), the pieces of a branch after the cut (numbered along
  the branch first, then across it: b_1, b_2, …), the parts of a junction split by the slits (v3_2), and the chords
  (s_1). The corners of the polygon of a junction of Q are lettered (v2a, v2b, …), in the cut and in the shortcut.
  Several indices in a row are separated by commas in the display (b_11 → b₁₁, b_1_1 → b₁,₁). Saved sessions with moves
  after a cut refer to the old names and graph, so those moves are skipped when such a session is opened.
