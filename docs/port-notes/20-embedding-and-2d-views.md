# 20 — Geometry, embedding and the 2D views

**C# source:** `GeometricObjects_Abstract/*` (`ModelSurface`, `Geodesics`, `GeodesicSurface.GetPathFromWaypoints`,
`ShiftedCurve`, `ConcatenatedCurve`, `Homeomorphisms`, …) and `GeometricObjects_Visualization/*`, about 3000 lines
**Target:** `src/geometry/hyperbolic.ts`, `src/embedding/{strand-order,chart,layout}.ts`, `src/render/svg.ts`
**Status:** 🔍 new design (the agreed design doc § 3); M2 of the plan

## What replaces the C# curves

The C# code stored a curve on every strip and moved it with every move (restricting, concatenating, shifting). The port
stores no geometry (design doc): the picture is **computed from G, its cyclic orders, μ and the model** after every move.
None of the C# curve classes are ported. The hyperbolic geometry that remains is small.

## Geometry (`src/geometry/hyperbolic.ts`)

- The Klein, Poincaré and upper half-plane models and the conversions between them. **The layout works in Klein
  coordinates**, where geodesics are straight lines. A straight segment, sampled densely and mapped pointwise, is the
  geodesic in the display model. Upper half-plane: included, as you suggested, since it is only a Möbius map.
- `DiskIsometry`: z ↦ (az + b)/(b̄z + ā), with rotations, half-turns, composition and inverse.
- `regularPolygon(n, "ideal" | "compact")`: ideal vertices on the circle, or the compact polygon with angles 2π/n (Poincaré
  radius √cos(2π/n), as in C#).
- `sidePairing`: the rotation onto the partner side, followed by the half-turn about its midpoint. It maps a side onto its
  partner with t ↦ −t (measured from the midpoint), and the polygon onto its neighbour. That is the complete hyperbolic
  structure of the regular ideal polygon (zero shear at the cusps).

## The strand order (`src/embedding/strand-order.ts`), a new algorithm

Along each edge of G₀, the strands of μ (the letters of the μ-images) have to be ordered. The design doc proposed comparing
strands by following them until they diverge. The port does something simpler that is also a proof:

> For each boundary word b₁ ⋯ bₘ of G (a face F), concatenate W_F = μ(b₁) ⋯ μ(bₘ). Each letter is one side of one
> strand, with F on its right. Cyclically reducing W_F gives a boundary word of G₀. **Two letters ℓ, ℓ̄ that cancel are
> the two sides of a gap of F between two adjacent strands**, since the part of F's boundary between them bounds a disk.
> **A letter that survives belongs to the outermost strand**, next to the face of G₀.

Every side of every strand faces exactly one face, so one pass over the boundary words gives all "immediate neighbour"
relations, and the order along each edge is their chain. If the relations don't form one chain per edge, the map doesn't
come from an embedding, and `strandOrder` throws.

The same function orders the **pieces of f(F) inside the strips of F** for g : G → G (the striped view). This is exact only
when g is tight: a non-tight image isn't realized by an embedding with exactly those letters. The striped view then says
"pull tight first".

This found **two presets that weren't geometric** (port note 19). `checkIntegrity` now also checks that g preserves the
boundary words.

## Charts (`src/embedding/chart.ts`)

Every model is drawn as **regions, ports and bands**:

- **Regions:** a convex region per vertex of G₀.
- **Ports:** a port per oriented edge x on the boundary of its source's region, with a lateral coordinate u from −1
  (right) to +1 (left), looking outwards.
- **Bands:** each edge of G₀ is either **glued** (port x ≡ port x̄ with u ↦ −u, after an optional straight stub) or a drawn
  **band** along which the strands run side by side.

| Model   | Regions                                                 | Ports                                                                                             | Bands                                                                                                                                                |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| polygon | the polygon (Klein, or flat coordinates)                | the sides (the middle 50–80 % of them)                                                            | glued, with the deck transformations (isometries / translations)                                                                                     |
| plane   | a disk around each base point                           | at the angles of the petals                                                                       | petals around the points; for the comb also the path edges                                                                                           |
| ribbon  | a disk per vertex of G₀, laid out along a spanning tree | evenly around each disk; a child's star is turned so that its tree band points back to the parent | the **spanning tree as real bands** (your idea), loops whose ends are neighbours as petals, the other edges glued at the ends of labelled half-bands |

`spineOfGraph(model, fs.spine0)` recovers which edge of G₀ belongs to which side or lasso from the structure of G₀.
That way the chart uses the same objects as μ, even after renaming.

## Layout (`src/embedding/layout.ts`)

1. **Ports:** the strands along each edge of G₀ get lateral widths **w(e)^c** (your suggestion, with 0 ≤ c ≤ 1; c = 0
   spaces them evenly), with gaps in between.
2. **Junctions:** a barycentric (**Tutte**) layout per region. Each junction is the average of the port points of its
   strands and of the junctions joined to it by strips with trivial μ (stems).
3. **Strips:** pieces of polylines, split at the gluings. Along bands they follow the band's centreline, offset
   sideways.

## The 2D views (`src/render/svg.ts`)

SVG, as you chose, generated as a string (headless: tested in Node, and ready for export).

- **standard**: the strips end at the **switches** of their gates on a small opaque disk around each junction. This is τ
  with the junctions closed, so strips in a gate arrive together.
- **tau**: larger transparent disks, with the infinitesimal branches of τ between the switches.
- **striped**: each strip as a light ribbon with one stripe per piece of f(F) inside it, coloured like the strip it comes
  from (f[F] ⊆ F).
- Options: display model (Poincaré, Klein, upper half-plane); smoothing (none, Catmull–Rom spline, or rounded corners,
  applied in chart coordinates, then mapped); **deck copies** up to a depth (hyperbolic: isometries, with junctions scaled
  by the local scale of the copy; flat: translations); strip width uniform or to scale; labels.
- A sober look: white background, serif labels, the C# palette.

I checked the pictures myself by rendering all presets and gallery models to PNG (with `@resvg/resvg-js`, a dev
dependency): ideal and compact octagons, the L-shaped surface with translated copies, the plane rose and comb, ribbon
graphs, the three views, and the tessellation.

## Known limits

- The layout doesn't yet avoid junctions that land on top of each other, when several junctions have the same neighbours.
- Deck copies of the plane models: none (the plane has no deck group to show here).

## Tests

- `src/geometry/hyperbolic.test.ts`: conversions, isometries preserve distances, side pairings map sides onto partners
  with t ↦ −t.
- `src/embedding/strand-order.test.ts`: cyclic reduction; one chain per edge for μ of every preset (before and after the
  algorithm) and for g after it; a broken μ is rejected.
- `src/embedding/embedding.test.ts`:
  - the deck generators glue u to −u on every side (hyperbolic and flat);
  - ports and regions for all gallery models;
  - the layout of every preset after the algorithm: strip pieces = gluings + 1, junctions inside the disk.
- `src/render/svg.test.ts`: all views in all display models without NaN, and the note for a non-tight g.

## Update: gates leave their junction together

- **Layout:** as in τ, each gate is a node of the Tutte layout between its junction and its strands. It is tied to
  the junction as strongly as to all its strands together, so it lies halfway, in the direction in which the gate
  leaves. Each strip first leaves its junction a short way in that direction.
- **Drawing:** each switch sits on the junction circle in the direction of its gate's node. The strands of a gate start
  at the switch and run straight out, **perpendicular to the circle and parallel** (side by side in their angular
  order, at most one radius wide together). Only then do they bend into their paths with a cubic Bézier curve (the C#
  `AdjustStartVector`, done more smoothly). The bend is at least about 30 pixels long, and longer for strands that turn
  far away from the gate's direction. This holds in the standard view and in the τ view.

## Update: order within a gate, arrows

- The strands of a gate are laid side by side in the **cyclic order of the star** (the strips of a gate are consecutive
  there; counterclockwise is from right to left, looking outwards). Before, their order came from the directions of
  their far ends, which was often reversed and caused avoidable self-intersections near the junctions.
- **Arrows:** a small arrowhead in the middle of each segment of a strip, pointing along its orientation.
- Dragging the view no longer selects the labels (`user-select: none`, and labels don't catch the mouse).
