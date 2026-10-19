# 27 — Contracting the wall for any number of new punctures

**Source:** not in the C# code. Extends port note 22, § 5 ("The author's idea: contract the wall").
**Target:** `src/geometry/cells.ts` (the slide), `src/examples/models.ts` (explicit cells), `src/embedding/remark.ts`
and `src/fibred/remarking.ts` (the remarking), `src/fibred/moves/cut-closed-surface.ts` and `fill-puncture.ts` (the
steps)
**Status:** ✅ approved (2026-10-19, in the conversation that led to port notes 24 and 26)

## The goal

After the closed-surface move, filling in p turns a chord from p to a point q₁ of Q into a **wall**: it stays a side of
its two cells, but its edge of G₀ is deleted (wall ↦ β⁻¹ in μ). For |Q| = 1, q₁ slides along the wall into p's corner,
and the original model and G₀ come back. For |Q| > 1 the wall was kept, because the chords at q₁ would no longer be
straight (port note 22, § 5).

Now q₁ slides into the corner for any |Q|, the other points of Q move along, and no wall is left in the result. The
timeline shows filling in p (with the wall) and the slide as two steps.

## The mathematics

1. **The slide changes neither G₀ nor μ.** The cells and chords stay the same complex: the chords at q₁ end at the
   corner, the wall shrinks to a point, and it has no edge of G₀ anyway.
2. **Moving the points changes nothing either.** Two straight-chord realizations of the same complex with the polygon
   boundary fixed differ by a homeomorphism that is the identity on the boundary, which is isotopic to the identity
   (Alexander trick).
3. **What degenerates is merged.** A cell next to the wall that was a triangle (q₁, c, c′) becomes a digon: its chord
   now lies on the side c c′ (or on another chord). It is merged with the cell across the chord that came from q₁: the
   dual edge in G₀ is contracted, and its letter is deleted from μ. Contracting an edge between two different vertices
   is a homotopy equivalence.
4. **Then cells are merged where they can be,** as `cellDecomposition` does: across a chord, longest first, as long as
   the union is convex. Each merge contracts an edge of G₀ again. For |Q| = 1 all chords then run between corners, all
   cells merge into the polygon, and G₀ is the original rose, as before.

## Proposal

1. **`slideIntoCorner`** (`geometry/cells.ts`, headless): given the corners, the points, the cells and the wall
   (corner c, point q₁),
   - replaces q₁ by c in every cell and drops the wall's side;
   - merges the digons (across the side that came from q₁);
   - places the remaining points with a **Tutte layout**: each point at the average of its neighbours along the chords,
     the polygon corners fixed (Klein coordinates, so the chords stay geodesics; Gauss–Seidel iterations);
   - merges cells across chords while the union stays convex;
   - checks the result: every cell convex and counterclockwise, and the areas add up to the polygon's. Otherwise it
     returns undefined, and the wall is kept as today.

   It keeps track of each cell side by the side it was before (the corners at both ends in the old numbering), and of
   which old cell each new cell contains.

2. **Explicit cells in the model.** `PolygonModel` gets `cells` (the corners of each cell, as in `SpineCell.corners`)
   and `exits` (the name of the edge of G₀ leaving a cell through each chord, keyed by the side from corner a to corner
   b). They are used instead of `cellDecomposition` when given. So the chords keep their names, and μ maps letter by
   letter. Only models made by the slide have them (they aren't saved; the session replays the moves).
3. **The model after the slide:** the compact polygon with `closed: false` (the vertex is a puncture again, q₁), the
   remaining points at their Tutte positions, and the explicit cells. If no point is left, it is the original model, and
   μ maps into the original G₀ object, as before.
4. **The remarking** (`fibred/remarking.ts`): `contracts` goes. `filled` and `finish` always give the walled state
   (the closed model with the points of Q, as today for |Q| > 1). A new `slide(surface)` gives the state after the
   slide, or undefined if `slideIntoCorner` fails.
5. **The steps** (`finishRemarking`, used by the cut and the shortcut): after "Remove B … fills in p" (or "Fill in p")
   comes the walled state, then a new step "Slide the puncture of v along the wall s into the corner", naming the
   chords that disappear, then the result.

## Not in this step

- A second closed-surface move on the result (port note 26): its model has points and `closed: false`, which
  `remarkClosedSurface` doesn't accept yet. That needs filling in interior points (the same trick) and comes next.
- An animated slide. The steps are discrete states.

## Later: several walls (port note 26)

`slideIntoCorner` is now a case of `contractWalls`, which contracts a list of walls in order: a filled-in interior
point moves into its neighbour, a point of Q into the vertex. The remarking fills in all punctures of P (the vertex
and the points of the old model), with one wall each, and contracts them along their trees.

## Tests

- `slideIntoCorner` on the octagon with one point (gives the single cell) and with two points (one point left, convex
  cells, areas add up, the digons merged).
- The closed genus-2 example, every cut and shortcut: for |Q| = 1 the original G₀ as before; for |Q| > 1 a model with
  |Q| − 1 points and no wall, μ valid and tight, every state of the timeline drawable, and the walled state among
  them.
