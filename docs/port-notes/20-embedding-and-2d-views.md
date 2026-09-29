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

- **train track τ**: the strips end at the **switches** of their gates on a small transparent disk around each
  junction, so strips in a gate arrive together, with the infinitesimal branches of τ between the switches. (This
  merges the former standard view, with opaque disks, and the former τ view, whose larger disks got in the way.)
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
  far away from the gate's direction. This holds in the train-track view.

## Update: order within a gate, arrows

- The strands of a gate are laid side by side in the **cyclic order of the star** (the strips of a gate are consecutive
  there; counterclockwise is from right to left, looking outwards). Before, their order came from the directions of
  their far ends, which was often reversed and caused avoidable self-intersections near the junctions.
- **Arrows:** a small arrowhead in the middle of each segment of a strip, pointing along its orientation.
- Dragging the view no longer selects the labels (`user-select: none`, and labels don't catch the mouse).

## Bug fix: reversed strands in gates

The strands of a gate were sometimes laid side by side in the reverse order, which gave avoidable self-intersections
(e.g. BH 6.1 at the start). There were three causes:

1. **A leftover in the layout:** the backward end of every strip still ran through the node of its gate before
   reaching its junction (left over from an earlier version, removed at the forward end only). So backward ends (A, B,
   …) came from a different direction than forward ends. That is why it was "sometimes right".
2. **The gate's direction:** it came from the average position of its strands, which is arbitrary for a wide gate. Now
   each gate leaves in the **middle of its angular span**: its strands in star order, their directions unrolled
   counterclockwise, from the first to the last. The direction straight behind the gate then lies outside the span.
3. **Directions measured in the display:** in the Poincaré disk, geodesics from a junction towards the far side of the
   disk all start almost towards the centre, so their order got lost in the sampling. The directions are now taken in
   the chart (Klein coordinates, straight lines) and only then mapped to the display. Continuous maps preserve the
   cyclic order.

The bends after the straight part are now drawn **in polar coordinates around the junction**:

- the angle turns from the gate's direction to the strand's, easing in and out, so they start and end radially;
- the radius grows to the target;
- strands that turn further end closer to the junction.

So at every angle a strand that turns more lies inside, and the bends are nested without crossings, even for turns of
more than 90°.

## Update: smooth bends

The bends are now constructed **in the chart**:

- **Why:** in the Klein model each strip leaves its junction as a straight ray, while in the Poincaré disk it doesn't. A
  bend constructed in the display therefore met the strip at an angle.
- **The shape:** in polar coordinates around the junction, the radius grows linearly, and the angle turns from the
  gate's direction to the strip's with the easing 6t⁵ − 15t⁴ + 10t³. It starts and ends radially, i.e. exactly in the
  direction of the straight bundle and of the strip beyond.
- **Length:** the bends are long enough that the radius grows noticeably while they turn. Otherwise the turn from
  sideways to radial happens within a short stretch and looks like a corner.
- **Nesting:** strands that turn further still end closer to the junction, so the bends stay nested.

The points are mapped to the display afterwards, which keeps the curve smooth.

## Update: close junctions and single gates

- **Close junctions** (your example: v with r and p in BH 6.1 after some steps):
  - the disk of a junction is at most 0.3 of the distance to the nearest other junction;
  - a spiral reaches at most 0.45 of that distance, and at most 0.45 of the straight piece of its strip, so that the
    spirals from the two ends of a short strip don't overlap.
- **Junctions with a single gate** (all strands in one gate) used the layout's node for the gate's direction, which is
  arbitrary. At q in that example this put the switch on the wrong side, and the strands ran through the disk. Now the
  cyclic order is cut at the largest angular gap between consecutive strands, and the gate leaves in the middle of the
  rest.
- While unrolling the directions of a gate, a tiny backward step (nearly parallel strands, ≤ 20°) counts as a step
  backward, not as almost a full turn.

## Update: arcs up to the tangent point, then straight (your construction)

The spirals ended pointing radially away from the junction, but a strip doesn't continue radially: it goes to the side
it crosses. So a curve turned one way during the spiral and back at its end. Now each strip end:

1. leaves its switch straight, in its lane;
2. turns on a **circular arc**, tangent to the lane, **until its direction points at its target**: the port on the
   side it crosses, or, for a strip with trivial μ, the end of the arc at its other end (determined in two rounds,
   starting from the midpoint);
3. runs **straight** (a geodesic in the chart) from this tangent point to the target.

The curve is tangent-continuous and turns only in one direction. Strands that turn further use smaller circles, so they
stay on the inside and the arcs of a gate are nested. The radii are capped by the nearest junction and by the distance
to the target.

- **Lanes of a single gate:** a single gate was cut at its widest gap for its direction, but its lanes still started
  where the star starts, so they could be in the wrong order (v in your second example). The lanes now use the same
  order as the direction.

- **Junctions close to other strips:** when a strip is subdivided out of a bundle of parallel strips, the new junction
  can lie right next to (or on the wrong side of) a neighbouring strip. After the Tutte layout, a junction whose
  straight segment to one of its ports crosses another strip is moved towards that port, past the crossing (a few
  rounds). The radius of the junction disk and the caps of the bending arcs are now bounded by the distance to the
  nearest other junction _or strip not ending there_, so the bends don't reach across a strip passing close by.

### Widths in the hyperbolic metric, gate spreading, the point under the mouse

- **Strip widths are constant in the hyperbolic metric** (for hyperbolic charts). SVG strokes have a constant width,
  so each strip is now a filled band: at every point of its display polyline, the offsets ±w/2 across it, where w is
  the hyperbolic width divided by the metric of the display model there (`lengthFactor` in `hyperbolic.ts`:
  2/(1 − |z|²) for Poincaré, 1/Im z for the half-plane, and for the non-conformal Klein model the length factor in
  the direction across the strip). The widths are measured in pixels at the centre of the model, so the strips get
  thinner towards the boundary and in the copies under deck transformations. The arrows shrink the same way; the
  striped view uses the same bands for its ribbon and stripes.
- **To scale** is scaled down by one factor so that at every junction the strands of each gate _together_ are no wider
  than the junction's disk (they leave the gate side by side, and their widths add up as in a train track).
- **Gate directions are spread:** gates whose directions (the middles of their angular spans) are closer than
  min(0.6 rad, 60% of an equal share) are pushed apart pairwise, keeping their cyclic order, so the infinitesimal
  branch between them stays visible and they don't look like one gate.
- **The point under the mouse** (the C# `Display(Point)`): `renderSvg` returns `echo(x, y)`, which maps the SVG
  point back to the chart, finds the copy of the polygon containing it, and returns the same point in the polygon
  and in every drawn copy, with the radius of a dot of constant hyperbolic size. The view draws them on an overlay.
- Junction disks and names are drawn in the dark green of the C# junctions (26, 105, 58).

### Sides, junctions in the copies, labels

- **Polygon sides** are bands of constant hyperbolic width too (1.5 pixels at the centre), in a style the view lets you
  choose: dashed (the default), dotted or solid. Dashes and dots have constant hyperbolic length. Towards an ideal
  vertex a side is infinitely long, so where it is thinner than 0.6 pixels it is drawn solid (dashes there would be
  invisible, and there would be tens of thousands of them; a long display segment is never cut at all).
- **Junctions in the copies:** their disks were left out below one pixel of radius, so the second ring of copies had
  none; now the limit is 0.3 pixels, and the outline, the infinitesimal branches and the switch dots shrink with the
  disk.
- **Strip names** sit beside their strips (on the left, half the width plus 8 pixels away) with a light halo, instead
  of on them.

### Geodesics, sides along them, the models, scaled names

- **`Geodesic`** (`hyperbolic.ts`, the C# `HyperbolicGeodesicSegment` extended to complete geodesics): stored as
  the isometry M of the Poincaré disk that maps the diameter (−1, 1) onto it, so that M(tanh(t/2)) is the point at
  arc length t from the base point M(0). Constructors from two points (either may be ideal), two ideal points (base
  point: the point closest to the centre), a point and a tangent vector; it gives the parameter of a point, the
  ideal points, the Möbius transformation, and the circle in the disk (centre and radius, orthogonal to the unit
  circle, or a diameter) and in the half-plane (a half-circle on the real axis, or a vertical line).
- **Sides** are drawn along their geodesics, sampled by arc length (steps of about 3 pixels, at most 0.1) right up to
  their ideal points (until they are within a pixel of them, or leave the picture): before, they were sampled
  uniformly in Klein coordinates, which near the boundary gives long display steps, so they looked straight there.
  The polygon (and each copy) is filled along the same samples. Dashes and dots are placed by arc length down to
  the width set by the slider next to "Sides" (0.3 pixels by default); beyond, the side fades to a faint solid line.
  The side width is at most 3 pixels, the strip width at most twice its width at the centre (in the half-plane
  both would grow without bound towards ∞).
- **Strips** are refined adaptively: a chart segment whose image is longer than 4 pixels is halved in Klein
  coordinates (where it is a geodesic) until it is short enough.
- **Deck copies in the Klein and half-plane models:** copies were kept only if their centre was within 0.995 of the
  centre _in the display_, which in the half-plane dropped all of them and in the Klein model most. Now the Poincaré
  radius decides, in every model.
- **Names** can be scaled with the metric ("scaled", on by default); then the copies get names too (below 2.5 pixels
  they are left out). In the Klein model, "Klein-shaped" maps each name by the linear map that takes the unit circle
  of the Euclidean metric to that of the Klein metric: the Klein metric has the eigenvalues 1/(1 − r²)² radially and
  1/(1 − r²) tangentially, so the map is (1 − r²) radially and √(1 − r²) tangentially (an SVG `matrix`).

### Options panel, hover, junctions in the Klein model

- The graphics options are a collapsible second row; the checkboxes say what they refer to (names, strip widths,
  junctions). "Strand spacing c" (formerly "Widths c") explains in its tooltip that it only moves strands on sides that
  several strands cross.
- Names are left out only below 1 pixel.
- Hovering a strip makes it 1.5 times as wide (an outline of a quarter of its width on each side, via a CSS variable
  per strip), instead of a fixed 5 pixels.
- With "Names and junctions shaped by the Klein metric", the junction disks become ellipses of the same area, shaped
  like the metric, and their switches lie on the ellipse.

### Straight through the gluings; the ribbon model's junctions

- **Straightening** (layout step 2′, slider "Straightening", 10 rounds by default, 0 = the old evenly spaced
  crossings): where a strip crosses a glued side, the crossing moves to where the segment from the previous point A to
  Φ(B) meets the side, B being the next point and Φ the isometry of the chart that carries the other side of the gluing
  onto the continuation beyond this one: the deck transformation of the copy across a polygon side (found as the
  generator, or its inverse, that maps the middle of the partner port onto this one), or for glued half-bands of the
  ribbon model the rigid motion joining their ends (there the strip gets two crossings, at both ends of the unrolled
  band). In Klein coordinates the geodesic is a straight line, so each update is a line intersection. Tutte solves
  and updates alternate. After each round the strands along each side are put back into their order by a
  least-squares fit with minimal gaps (pool adjacent violators, `orderedWithGaps`) and kept within the port, which
  lies inside the side, so on the L-shaped surface a strip whose straight continuation would leave its side stops at
  the end of the port.
- **Strand spacing c** now only matters with "Strip widths to scale": the gaps then leave room for the widths w(e)^c.
  Without it the strands are thin, and the gaps are 30% of the initial spacing, within 90% of the port.
- **Ribbon model:** a junction of valence k is a rounded k-gon: its ports are chords of its circle (nearly the sides
  of the inscribed regular k-gon, at most 1.5 radii long) joined by arcs, and the bands and half-bands are as wide as
  the ports, so nearly as wide as the junctions (petals at most half a radius, so that they don't overlap the disk).

### Standard view again, corners, widths to scale, petals

- **Standard view** (back): the strips run to the centres of the junctions, drawn as small filled green disks; no
  gates, switches or infinitesimal branches.
- **Corners** (formerly "Strips: smooth / rounded / straight", which hardly mattered any more because the spline
  acted on the chart polylines before the renderer rebuilt the strip ends): the drawn curves themselves are rounded
  where they turn by more than about 8° at a vertex, by a quadratic Bézier between the points r before and after it
  (r = 14, 6 or 0 pixels for smooth, rounded, sharp, at most 45% of the distance to the neighbouring corners).
- **Strip widths to scale no longer move the strands**: straightening keeps 30% of the first spacing between
  neighbours, whether or not the widths are drawn to scale; drawn to scale, all widths w(e)^c are shrunk by one factor
  until they fit between their neighbours and the ends of their ports. "Width exponent c" (formerly "Strand spacing
  c") sets these widths, and the spacing only with 0 rounds of straightening.
- **Petals of the plane model** were a straight stub from the port joined to the circle around the puncture at a
  corner, so the strands on the inner side folded back into small hooks. Now the centreline leaves the port along a
  short Bézier curve onto a tangent of the circle, goes around it counterclockwise, and returns along the tangent
  through the other port: smooth, and bending gently enough for the offset strands.
- **Straight as drawn:** the layout straightens each crossing towards the _switch nodes_ of the Tutte layout, but the
  drawn strip leaves its junction along its lane and an arc and runs straight only from the arc's tangent point T. So
  after straightening the drawn curve had a kink at the side (e.g. "Reducible map" in the Klein model). Now the
  renderer moves each crossing next to a junction to where the side meets the line from T to Φ(F), F being the next
  point beyond the gluing (the other end's tangent point, or the next crossing), alternating with the arcs for a few
  rounds, and moves its partner on the other side with it. It does this only for straightened layouts, and only up to
  halfway to the neighbouring crossings on the same side, so the order is kept. The layout now exposes its gluing
  maps and its number of rounds for this.

### Hairpins in the strand order

A junction of valence 2 whose two strips leave through the same side (the intermediate states of an isotopy that
moves a subdivision point across sides: the junction sits just beyond the side, and both of its strips cross it next
to each other) makes both of its corners read a cancelling pair ℓ ℓ̄ in the boundary words. Only the corner inside
the hairpin is the gap between the two strands; the face at the other corner wraps around the tip, and its two
letters belong to gaps with other strands. The ribbon structure can't tell the two corners of a junction of valence 2
apart, so `strandOrder` now first reduces as before, and if the strands don't form chains, forbids the cancellation at
one corner of each such junction (the reduction then pairs those letters with others), trying the choices until they
do. Before, these states could not be laid out, and the timeline drew them with the state before the isotopy, so the
strips at the moving junction kept their old μ.

## Update: side names, the part of the sides used, the pointer outside the disk

- **Side names** sit at the middle of the side as drawn (the geodesic, which bows towards the centre, not the chord
  between its ends), just outside it: the gap is measured on the screen, half the name's height and two pixels. They
  are larger (20 px at the centre, scaled by the metric like the other names).
- **Crossings reach** (graphics options, polygons only): the part of each side, around its middle, that the strands
  may cross (`ChartOptions.sideFraction`); by default half a side for ideal polygons, 75% for compact and 80% for flat
  ones (the constant `SIDE_FRACTION` before). For ideal polygons, whose sides are infinitely long, it is measured along
  the side in the Klein model. The straightening only uses the part; without straightening the crossings are spread
  evenly over it. Charts and layouts are cached per value.
- **The pointer outside the disk:** the point under the mouse was mapped to Klein coordinates before checking that it
  lies in the model, and that map sends a point outside the Poincaré disk (or below the half-plane) to its mirror image
  inside, so dots appeared in the polygon and its copies. The check now happens in the model shown.
- **Ideal vertices up to rounding:** a vertex of an ideal polygon such as (−½, −√3/2) has |k|² = 1 − 2·10⁻¹⁶ in Klein
  coordinates, and the square root in the map to the Poincaré disk magnified that to a point 10⁻⁸ inside the
  boundary: not ideal, so a side from it had its "middle" next to that vertex, and its name was scaled away (in the
  hexagon a b c C B A only b and c had names). `kleinToPoincare` now maps points within 10⁻¹² of the boundary to ideal
  points.
- **Names in the Klein model** are scaled by the geometric mean of the radial and tangential factors of the metric
  (it is not conformal), not by the horizontal one, so names at the same distance from the centre have the same size.
