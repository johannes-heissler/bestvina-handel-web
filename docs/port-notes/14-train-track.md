# 14 — The train track τ

**C# source:** `FibredSurfaceTrainTracks.cs` (149 lines: `ConvertToTrainTrack`, gate vectors for drawing)
**Target:** `src/fibred/train-track.ts`, `src/examples/maps.ts`
**Status:** 🔍 ported, **as a new design** decided with the author on 2026-09-25

## The decision

The C# code has a final move "convert to train track" (`ConvertToTrainTrack`). It adds every infinitesimal branch as a
strip of G, so the graph gets many more edges, and the program then continues with that graph.

The port doesn't do that. Instead, **τ is always derived from (G, g)**, as a separate structure next to the fibred surface:

- the display always draws the junctions as small disks with the switches (gates) on their boundary and the
  infinitesimal branches inside, whether or not g is already a train-track map. The directions of the strips in a gate
  are aligned, as in the thesis's move "Graph smoothing";
- no move changes G into τ;
- τ carries its own, weaker combinatorial map g_τ : τ → τ, which the closed-surface move (next module) works with.

## Construction

`trainTrack(fs)` follows the thesis, § "Constructing the train track":

- **Switches:** one per gate, in the cyclic order of the gates around their junction.
- **Real branches:** one per strip, from the switch of its gate at the start to the switch of its gate at the end.
- **Infinitesimal branches:** the pairs of gates (γ, γ′) at a junction that some image g(e) turns between, closed under
  Dg (the remark after the move in the thesis). Illegal turns (both strips in the same gate) get no infinitesimal branch.
  So τ can be built for any g, and the picture then shows where g isn't a train-track map yet.
- **The cyclic order at a switch:** its real branch ends in the order of the star, then the infinitesimal branches to
  the following gates, in the cyclic order of the gates. In the picture, the real branches point outwards from the disk
  and the infinitesimal branches are chords of the disk.
- **g_τ:** the image of a real branch is g(e) with the infinitesimal branch of each turn inserted. An infinitesimal branch
  (γ, γ′) is mapped to (Dgγ, Dgγ′).
- **Widths** (when λ > 1): the Perron–Frobenius widths on the real branches. On the infinitesimal branches they are
  w_inf = (λ − M_inf)⁻¹ · M_{G→inf} · w_G (the thesis, § "Assigning widths and lengths on τ"). `switchEquationDefects`
  checks the switch equation.
- **Boundary words of τ with their cusps:** a cusp is a turn between two branches on the same side of a switch. Words
  consisting only of infinitesimal branches are infinitesimal polygons (singularities of angle kπ for k cusps).

## Tests

`src/fibred/train-track.test.ts` (4 tests):

- **The Anosov map on the torus:** 3 switches, 2 infinitesimal branches (a line, no polygon), 2 cusps at the puncture.
- **The switch equation** holds at every switch (to 10⁻⁹) for the torus and for the closed-surface example. That
  checks the widths and the cyclic orders at the switches together.
- **The closed-surface example** (`closedGenus2OneCusp`, the author's example, genus 2 with one puncture, λ ≈ 4.3152): an
  infinitesimal triangle in each of the 5 junctions and exactly **one cusp** at the puncture, so filling it in would give
  a singularity of angle π.
- τ can also be built for a map that isn't a train-track map yet.

g_τ passes `checkContinuity()` in all cases.

## Relation to absorbing into the periphery

The thesis remarks that "absorbing into the periphery" is the same as building τ on G/P when each peripheral component has at
least three gates in G/P. That move (C# `FibredSurfaceAbsorbingIntoPeriphery.cs`, 623 lines) will be ported with this
structure in mind.

## Update: the linear order of a single gate

Every gate has a linear order of its edges (across the band that f maps the junction's neighbourhood into, right to
left). At a junction with several gates, it is the cyclic order of the star cut open after the previous gate. At a
junction with a single gate (gatewise extremal), the star only gives a cyclic order; before, τ cut it open at the first
edge of the star and the drawing at the widest angular gap of the layout, both arbitrary. This decides which turn at the
junction is smooth (around the back of the switch) and which are cusps, so it matters for the singularities.

`gate-order.ts` now finds it from the strands of f[F] ⊆ F (`strandOrder(g)`, as in the striped view): two edges x, y
whose images start with the same strip d are ordered by their first strands across d; otherwise their images leave the
image junction by different strips of one gate there, which are compared recursively (at a junction with several gates
by the known order). Unlike following where the images of g^k diverge, this also decides when g(x) = g(y). The result
must be a rotation of the star (f preserves the orientation), which is checked. Tested: at junctions with several
gates, it reproduces the known order in all states of BH 6.1.

- τ (`TrainTrack.singleGateOrder`) and the drawing use it. Where it is undecided (pretrivial strips, whose images have
  no strands; g not tight; no train track), τ keeps the old convention and the drawing shows the junction without
  aligning its strips, as in the standard view. Such states occur only in the middle of the algorithm.
- Folding doesn't need it: the strips to fold are those whose images start with the common initial segment, and since
  g comes from an embedding they form an interval of the linear order, including the branches in between.
  `inCyclicOrder` now also checks this at junctions with a single gate and reports an inconsistency otherwise (never
  seen in the examples).
