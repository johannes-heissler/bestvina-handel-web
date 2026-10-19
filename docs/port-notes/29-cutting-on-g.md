# 29 — Cutting on G, with only Q blown up

**Source:** not in the C# code. Follows port note 28 (in the conversation that led to it); replaces the contraction of
port note 22, § 6, for new sessions.
**Target:** `src/fibred/cut-along-leaf.ts` (the cut), `src/fibred/moves/cut-closed-surface.ts` (the move),
`src/fibred/train-track.ts` (`switchesOf`)
**Status:** ✅ approved (2026-10-19, in the conversation: "yes please, and start with the implementation")

## The problem

The cut was carried out on all of TS(τ): every junction of G was blown up into its infinitesimal polygon, the slits
were cut, and then the polygons outside Q were contracted again (`collapseUncut`), in every state shown and at the
end. That contraction is a step of its own with its own justification. In the cut track, each such polygon is one
face made only of polygon pieces (a triangle in the examples) plus copies of polygon sides along the slits. The face
is filled in: one side ε is replaced by the rest of the polygon, backwards, which holds only through the disk. That
is allowed because the faces are disks in Σ ∖ Q and g′ permutes them. The copies along the slits form a forest, and
it is collapsed. In the end, all of it just deletes the polygon letters from the images.

None of it is needed. G is the current graph anyway, and the polygons outside Q are never shown.

## What τ is needed for

- **The leaf L and its preimages** (`slitsForProng`): their paths and their heights in each branch, and where the
  preimages end partway into a branch. This needs τ's switches, arcs and infinitesimal widths (which turn the leaf
  takes at a junction, and at which height it continues).
- **The image strands** (`strands.ts`): where the image of each strip runs within each letter of its image. They give
  g′ on the pieces.
- **The polygons of Q:** the new punctures sit inside them, and the slits start at their corners. Images that pass
  through a junction of Q go around the puncture on one side, so the polygon sides are needed there.

## The construction

`cut(tt, slits, { blownUp })` blows up only the junctions in `blownUp` (Q). For the others:

1. **Pieces:** only the real branches and the infinitesimal branches of Q get pieces. The infinitesimal letters of
   other junctions are left out of the slits and the images.
2. **A junction v outside Q is a disk.** Its boundary carries the piece ends of its strip ends, counterclockwise: switch
   by switch in the cyclic order of the gates (`TrainTrack.switchesOf`), each switch's from the bottom of its arc to
   the top. A slit through v arrives along a real branch at the switch s, runs along an infinitesimal branch to the
   switch t, and leaves along a real branch. So it is a **chord** of the disk, from the gap between two pieces on one
   strip end to the gap between two pieces on another. The chords don't cross (leaves are disjoint).
3. **The parts of v** are the regions of the disk between the chords. Walking along the boundary counterclockwise
   and crossing over along each chord gives each part with its star in the right cyclic order. Each part is a junction
   of the result. A slit that ends at v (after a whole branch) gives no chord: the pieces on both sides of it stay at
   the same part.
4. **The rest is as before:** the arcs of the switches of Q and of the subdivision points inside branches are split
   where both sides have a boundary at the same height, and g′ maps each piece along its image strand.

The infinitesimal polygon of v, a disk, lies inside one of the parts and isn't represented. In the examples, the
other parts are the thin sides of the slits (valence 2), which the line merge of port note 28 removes.

**Names** (`nameParts`): the parts of v are v, v_2, …; the corners of Q are lettered (q_a, q_b, …), as
`collapseUncut` named them.

**μ** (`cutMarkingOnG`): as for the blown-up graph of the shortcut (`markBlownUp`). A piece runs along its part of
its branch of τ, and, from a part of a junction outside Q, first through the inside of the junction to the switch of
its gate (`Remarking.toSwitch`). The parts lie in the junction's cell.

## The move

- The states shown are the cut graphs themselves (copied, μ pulled tight). The state before the cut is `cut` with no
  slits: G with Q blown up.
- `cutOptions` decides "B is a circle attached at one junction" on the same cut.
- The removal of B (port note 28) no longer contracts anything first, and the fallback to the old order is gone.

## Saved sessions

Not kept (author, 2026-10-19): no saved sessions with a cut are known, so compatibility isn't worth the old code.
The cut of all of TS(τ), `collapseUncut`, `removeAlmostPeripheralCircles` and the flag `FibredSurface.legacyCut` (with
the session format 5 of port note 28) are removed; the format stays 4. A saved session with a cut replays with the new
cut, and the moves after it may be skipped.

## Tests

- Before the old cut was removed: for the cuts at p, q and w of "Closed genus 2" (w with 583 junctions), the new cut
  had the same stars and the same g′ as the old cut followed by `collapseUncut`, with the real pieces matched by their
  place in τ (branch, height, start), and `cutOptions` found the same lengths (16 and 18 for p and q).
- `cut-along-leaf.test.ts`: g′ is continuous and has the same growth, and the switches (of Q and inside branches)
  satisfy the switch equation, for every prong and short lengths.
- The tests of port note 28 (B pink, merged into a loop and removed, 6 junctions of valence 3 left) and of the
  closed-surface model (every state drawable in the original polygon) pass unchanged.

## Open points

- The disk picture assumes that the gates of a junction are contiguous blocks of its star, as τ's construction does.
