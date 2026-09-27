# 19 — Model surfaces, the gallery, presets and map editing

**C# source:** `Surfaces_Explicit/SurfaceGenerator.cs` (903 lines: `GenerateGeodesicSurface`, `SpineForSurface`,
`CreateSurface`, the parameter syntax), `UIElements/MainMenu.cs` (`InitializeExample`), `Strip.ReplaceWithInverseEdge`,
`FibredSurfaceMenu.UpdateGraphMap` with `GraphMapUpdateMode`
**Target:** `src/examples/models.ts`, `src/examples/gallery.ts`, `src/examples/presets.ts`, `src/fibred/map-editing.ts`,
`fromStars` in `src/graph/from-boundary-words.ts`, `RibbonGraph.invertEdge`
**Status:** 🔍 ported (combinatorial part; the geometry follows in M2)

## Model surfaces

A model says how a surface is drawn, and it determines the reference spine G₀. There are three kinds (your answers to
A1–A3):

- **polygon**: a polygon with its sides glued in pairs, given by its **word**: the side labels read counterclockwise,
  where x and X are glued with opposite orientations. G₀ is the dual rose, and **its star is the word itself**, so
  the vertex classes of the polygon are the boundary words of G₀. The geometry is `ideal` (every vertex class is a
  puncture), `compact` (a closed surface with angle sum 2π at its one vertex class, which is a marked point), or `flat`
  with explicit vertices (translation surfaces: square torus, the L, the regular octagon).
- **plane**: points in the plane, with ∞ as one more puncture, and no sides. G₀ is a `rose` of lassos from one base
  point (points on a line or on a circle), or a `comb`: each point has its own base point, joined from left to right.
  The comb is a different ribbon graph from the rose.
- **ribbon**: the fibred surface of a ribbon graph given by its boundary words, which will be drawn glued from rectangles
  (your idea). G₀ is that graph. Examples: your closed genus-2 example, with 5 junctions, is a ribbon model.

`spineOf(model, { names, reversed })` builds G₀. Its edges can be **renamed and reoriented** (as you did by hand for
BH 6.1), and it records which oriented edge crosses which polygon side (`sides`) or goes around which point (`lassos`),
for the geometry. `topology(model)` reads genus and punctures off G₀ (χ = V − E and the number of boundary words).
`isClosed` marks closed models.

Interior punctures of polygons are left out for now, as agreed. There are only the two extremes: the plane, and
polygons without extra punctures inside.

## The initial fibred surface and peripheral lassos

`initialFibredSurface(model, { peripheral, peripheralStrips, names, reversed })` returns G = a copy of G₀,
μ = the identity onto G₀, and g = the identity. For each peripheral puncture (by default the ones with the shortest
boundary word first, as in C#), it adds a **lasso** as the C# `SpineForSurface` does:

- a strip e of G next to the puncture is replaced by a **stem** s, at the same place in the cyclic order;
- a **loop** q around the puncture sits at the end of s;
- the rank stays the same.

μ, worked out for the port: **μ(s) is trivial**, and **μ(q) = μ(F′)⁻¹**, where F′ is the boundary word F of the
puncture in G, rotated to end with ē. Then the outer boundary word maps to the one that contained e, and q's inside
maps to F, which the integrity check confirms. As in C#, strips named with a digit (split sides) are preferred, and
the removed strip is deleted before the stem is added, so the stem reuses its name.

`peripheralStrips` makes existing strips of G₀ peripheral, for ribbon models that already contain the circle.

## The gallery

`gallery(g, p)` lists several models for genus g with p punctures (p = 0: closed, punctured once artificially), each
checked to have that topology:

- **genus 0:** the plane with points on a line, the plane with points on a circle, the comb, and the symmetric ideal
  polygon of C# (`a b c C B A`).
- **genus ≥ 1:**
  - the standard polygon `a b A B ⋯` with the extra punctures as adjacent pairs `x X` at the end;
  - the punctures spread between the handles;
  - the C# layout with **split sides**: an extra puncture splits a side a into a a′ and its partner into A′ A;
  - all punctures on one split side;
  - for g ≥ 2, the polygon with **opposite sides** glued;
  - for one vertex class, the **flat** models: square torus, L-shaped surface (`a b c B d A D C`), regular octagon.

  A closed torus is only the flat square.

The C# parameter syntax (`g=2,p=1,P=0`) is gone, as you decided. The UI will offer genus, punctures, P and the model
separately. Gallery pictures will be rendered once and cached (M3).

## Presets

`PRESETS` holds the C# examples as data: model, naming, setup moves, renames, and map texts with their modes.
`buildPreset` builds one.

| Preset                         | How                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anosov map of the torus        | `a b A B`, a ↦ a b, b ↦ b a b                                                                                                                                                                                       |
| Half twist                     | the C# layout `a c b C A B` (split side), b reversed, a ↦ c A b c B                                                                                                                                                 |
| Reducible map (**new, valid**) | the standard polygon, a ↦ a B, b ↦ b A b (Anosov on the first handle) and the Dehn twist c ↦ c d. The C# one didn't preserve the boundary words.                                                                    |
| BH 6.1                         | `a b A B c d C D` with c, d reversed and swapped, the paper's map                                                                                                                                                   |
| BH 6.2                         | `a b c C B A` with 3 lassos; collapse the stem a; rename b → a, γ → α, α → β, β → γ (found by a search over all names and orientations of the strips; the first version of this preset wasn't geometric, see below) |
| BH 6.3                         | the plane rose with the star `a A b B c C d D` (your cyclic order), a ↦ b ↦ c ↦ d ↦ A D C B                                                                                                                         |
| Point push                     | the C# text with the named path ρ and conjugations                                                                                                                                                                  |
| Point push as a composition    | the four pushes along α, γ, β̄, δ, postcomposed                                                                                                                                                                      |
| Random genus 2                 | 10 of the C# Dehn twists, reproducible from a seed                                                                                                                                                                  |
| Closed genus 2                 | your example as a closed ribbon model                                                                                                                                                                               |
| Twisted stem, swapped handles  | the test examples of port notes 16 and 17                                                                                                                                                                           |

**Observation for your point-push experiment:** the two descriptions start with λ = 38.0 (named path) and 75.5
(composition), and **both end at the same pseudo-Anosov with λ ≈ 22.5364** after 9 moves each. The `PushingPath`
version comes with the point-push module.

## g must preserve the boundary words

Writing the embedding (module 20) showed that two presets weren't geometric: g mapped a boundary word to a loop that isn't
one. `checkIntegrity` only checked μ, and C# didn't check g either. **`checkIntegrity` now also checks that g maps every
boundary word onto one** (the thesis's criterion for being the carrying map of a homeomorphism). The collapse-forest test
fixture had the same problem (g(a) = a instead of a b) and was fixed.

## Map editing

`updateMap(fs, text, mode)` with the C# modes: `replace` (g ← h), `postcompose` (g ← h ∘ g), `precompose` (g ← g ∘ h).
Unmentioned strips are fixed by h. `invertStrip` reverses a strip's orientation (the C# `ReplaceWithInverseEdge`,
including μ). `renameStrip` renames a strip, and an uppercase name inverts it. `renameJunction` renames a junction.

## Tests

`src/examples/examples.test.ts` (31 tests): topology of the model kinds, the polygon word as the star of G₀, renaming and
reversing, lassos passing the integrity check for several models and P, closed models, the gallery for 9 (g, p) with
every model's topology and initial surface checked, every preset valid, the torus growth, both point pushes reaching the
same λ, and random maps reproducible from the seed. `src/fibred/map-editing.test.ts` (6 tests): the three modes,
named paths, inverting and renaming.
