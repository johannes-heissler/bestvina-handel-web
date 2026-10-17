# 23 — Showing a state in another model (ribbon graph ⇄ polygon)

**Source:** not in the C# code. Builds on `contractedWord` and the `options.graph` start of port note 22.
**Target:** `src/examples/models.ts` (the conversion), `src/ui/SurfaceView.svelte`, `src/ui/drawing.ts` (the view)
**Status:** ✍️ note awaiting review

## The goal

The Model dropdown of a view offers the disk models (Poincaré, Klein, upper half-plane) only for hyperbolic polygons.
It should also offer **Ribbon graph**, and a view of a ribbon model should offer the **polygon** models. Both switches
only change how the current state is drawn. The session, its history and the saved files stay as they are.

## The mathematics

A view needs a model M, its spine G₀ and the marking μ: G → G₀. Switching the model means finding a new spine G₀′ and
a homotopy equivalence φ: G₀ → G₀′ that respects the ribbon structures. The new marking is then μ′ = φ ∘ μ. g, the
strips, their names and the periphery stay the same.

- **Any model → ribbon graph.** G₀ already is a ribbon graph, so G₀′ = G₀ and φ = id. The model is the ribbon model of
  `spine0.boundaryWords()`, which `ribbonModelOf` in `session.ts` already builds. The surface is not copied.
- **Ribbon graph → polygon.** Contract a spanning tree T of G₀. The result is a rose, and its star is the word of a
  polygon whose sides are glued like its petals (`contractedWord`). G₀′ is the dual rose of that polygon. φ maps the
  edges of T to the empty path and every other edge to the side of the same name. Contracting a tree is a homotopy
  equivalence and keeps the cyclic orders, so the strand order stays defined. μ′(e) = φ(μ(e)), freely reduced.
  - The vertex classes of the polygon are the boundary words of G₀, i.e. the punctures. So the polygon is **ideal**
    when the surface has punctures, and **compact** (`closed: true`) when it is closed. A closed ribbon model has one
    boundary word, so its polygon has one vertex class, as a compact polygon needs.
  - The `options.graph` start of port note 22 is the special case G = G₀ and μ = id. It should call the same function.

## Feasibility (checked on 2026-10-17)

A throwaway test drew every preset in the other kind of model, at the start and after the autopilot, in the standard
and train-track views. No drawing failed:

- all polygon and plane presets as ribbon graphs;
- "Twisted stem" (polygon AbpPaB) and "Swapped handles" (polygon AbcDCdaB) as polygons;
- "Closed genus 2" after the closed-surface move, through the ribbon graph of the new spine (23 vertices, one boundary
  word), as a compact octagon.

The pictures themselves were not looked at yet.

## Proposal

1. **`remodel(model, surface, kind)`** in `src/examples/models.ts`, headless. It returns `{ model, surface }`:
   - `"ribbon"`: the ribbon model of G₀ and the same surface;
   - `"polygon"`: the polygon of `contractedWord(spine0)` and a new `FibredSurface` sharing graph, g and periphery,
     with μ′ = φ ∘ μ (via `CombinatorialMap.after`, then reduced). `isClosed` is kept.
   - Any other conversion (into the plane, or into a polygon with interior points) is not offered.
2. **The view.** The Model dropdown is always shown:
   - for a hyperbolic polygon: Poincaré, Klein, upper half-plane, Ribbon graph;
   - for the plane, a flat polygon or a polygon with interior points: its own model and Ribbon graph;
   - for a ribbon model: Ribbon graph, and the polygon in Poincaré, Klein or upper half-plane.

   The converted pair is cached per surface (a `WeakMap`), so that the existing chart and drawing caches keep working.
   Hovering, highlights and the strip cards use the strip names, which don't change.

3. **The timeline** (animated steps) converts each state the same way. The spine is the same along a timeline except
   at a closed-surface move, so the tree and the polygon stay the same between the states.

## Open questions

1. **The spanning tree.** `contractedWord` takes a breadth-first tree from the first vertex, so the polygon depends on
   the order of the vertices. That is deterministic, and G₀ only changes at a closed-surface move. Is that enough, or
   should the tree be chosen for a better shape (e.g. so that few strips have μ′ = ∅), or be chosen by the user?
2. **Peripheral loops.** A loop p with the boundary word "P" (as in "Twisted stem") becomes two neighbouring sides
   p P with a cusp between them. That is correct, but the cusp is a very thin spike. Acceptable?
3. **The session after a closed-surface move.** Port note 22 keeps a closed polygon without interior points through the
   move. Other models still fall back to the ribbon model of the new spine. Should the session use `remodel` there to
   go back to a compact polygon? Unlike the view switch, that changes μ and the model of the node, so later
   closed-surface moves could then also be followed in the polygon. This would be a separate step after the view
   switch.
4. **Saving the choice.** The model of a view is not saved today (only the layout). Should the converted view be
   remembered per view, like the other view settings?

## Tests

- `remodel` to the ribbon graph and back gives the same polygon word for every polygon preset without interior points
  (up to rotation), and the resulting surfaces pass `checkIntegrity`.
- μ′ is a valid marking: `checkContinuity` is empty and the boundary words are preserved.
- Every preset, at the start and after the autopilot, draws in the converted model without a "can't be drawn" note
  (the feasibility check above, as a test).
- The `options.graph` start gives the same surface as before (same μ, same colours).
