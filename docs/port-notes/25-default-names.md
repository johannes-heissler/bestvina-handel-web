# 25 — Default names of junctions, strips, switches and branches

**Source:** not in the C# code (which named everything `v0`, `e0`, `b@1`, …). Touches `src/graph/names.ts`,
`src/graph/ribbon-graph.ts`, `src/graph/from-boundary-words.ts`, `src/fibred/names-and-colors.ts`,
`src/fibred/train-track.ts`, `src/fibred/cut-along-leaf.ts`, `src/fibred/moves/cut-closed-surface.ts`,
`src/examples/models.ts`, `src/examples/gallery.ts`, `src/examples/presets.ts`, `src/embedding/chart.ts`,
`src/render/svg.ts`, the Svelte components that show names, `src/session/session.ts`
**Status:** 🔍 implemented (2026-10-19) as decided with the author in chat (2026-10-17/19)

## The goal

Generated names that put a number right after a letter (`v1`, `b@1`, `v2a`, `ε3`, `t1`) are hard to read. Every
generated name should either come from a list of letters, or carry its index as a subscript.

## What the names were

| Where                                         | Before                                | Seen as                                                  |
| --------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `RibbonGraph.addVertex` default               | `v${id}`                              | the junctions of every G₀ and of the G copied from it    |
| `cutAlongLeaf`: switches subdividing a branch | `b@1`, split: `b@1_0`                 | junctions after cutting along a leaf                     |
| `cutAlongLeaf`: parts of a split switch       | `v_0_0`, `v_0_1`                      | junctions after cutting along a leaf                     |
| `junctionPartName`: corners of Q              | `va`, `vb`, …, `vz`, `vb2`            | junctions after the closed-surface move                  |
| τ: switches                                   | `v_0`, `v_1`                          | τ, and junctions after a cut                             |
| τ: infinitesimal branches                     | `ε1`, `ε2`                            | τ, and peripheral strips after the closed-surface move   |
| fallbacks of the name lists                   | `e1`, `v1`                            | large surfaces                                           |
| chords of a polygon with interior points      | `s_1`, `s_2` (the wall uses one up)   | G₀ and G                                                 |
| plane: lassos beyond 26, comb path            | `l27`, `t1`                           | G₀ and G                                                 |
| peripheral lassos of the initial surface      | `α β γ δ ε ζ η θ ι κ λ`, then `ρ1`    | G (includes ε and λ, unlike the later peripheral strips) |
| gallery side labels                           | `abcdefghijkmnop…` (includes e, f, g) | G₀ and G                                                 |

## Decisions

1. **The name lists move to `src/graph/names.ts`** (`EDGE_NAMES`, `PERIPHERAL_EDGE_NAMES`, `VERTEX_NAMES`,
   `firstUnusedName`), so that the graph layer can use them. The colours stay in `fibred/names-and-colors.ts`.
   - `RibbonGraph.addVertex()` without a name takes the first unused name of `VERTEX_NAMES` (v, w, p, q, r, s, t),
     `addEdge()` the first unused one of `EDGE_NAMES`. So G₀ of every model, and `FibredSurface.fromText`, have the
     junctions v, w, p, … instead of v0, v1, v2.
   - The fallbacks get subscripts: `e_1`, `e_2`, … and `v_1`, `v_2`, … (e and v on purpose: general edges and
     vertices).
2. **Gallery and models.**
   - The gallery labels its sides from `EDGE_NAMES` (a b c d x y z u h …), so never e, f, g.
   - Chords take the next names of `EDGE_NAMES` after the sides. The wall candidate (the first chord from the vertex
     class to an interior point) is named last, whether or not the model is closed, so the visible chords have no gap
     and the open and the closed model of the same polygon name their chords alike (the remarking relies on that).
     Chord names also avoid the names that `SpineNames` gives the sides.
   - Plane lassos are named from `EDGE_NAMES`. The comb path edges are `t_1`, `t_2`, ….
   - The peripheral lassos of the initial surface take `PERIPHERAL_EDGE_NAMES` (γ δ θ …), like every other new
     peripheral strip. BH 6.2 renames them to α, β, γ as before.
   - The stem of a peripheral lasso gets a fresh name that no edge of G₀ has (μ of the stem is trivial, so a side's
     name would be misleading; this also covers the names that earlier lassos freed). The C# rule "prefer strips named
     with a digit" goes: the split sides are lettered now, so it only made the stem replace a chord or a comb edge.
3. **Letter indices**, shown as subscripts: `index(k)` counts like spreadsheet columns, a … z, aa, ab, … (base 26
   with the digits a … z), and `greekIndex(k)` the same with α … ω.
   - Corners of the junctions of Q: `v_a`, `v_b`, …. The parts of other junctions that the slits split stay `v_2`, ….
   - Switches of τ: `v_a`, `v_b`, … (the gates of v counterclockwise, as before).
   - Infinitesimal branches of τ: `v_α`, `v_β`, … at the junction v, in the order they are created (e.g. v_α from v_a
     to v_b, v_β from v_b to v_c). They become the peripheral strips of the polygons of Q after the closed-surface
     move, so they keep a Greek letter there.
   - `cutAlongLeaf`: the switches subdividing a branch get fresh names from `VERTEX_NAMES` that no junction of the
     old surface and no other switch has. A split switch gets letter indices (`v_a_a`, `v_a_b`).
4. **Showing subscripts.** A name is a base followed by indices (`_` and letters or digits; several in a row are
   separated by commas, `b_1_1` → b₁,₁). Where markup is possible, the indices are real subscripts: `<sub>` in HTML,
   a `<tspan>` lowered with `dy` in SVG (`dy` rather than `baseline-shift`, which Firefox and resvg ignore). Where
   only text is possible (`<option>`, tooltips), an index is written with Unicode subscripts if they all exist
   (digits, and a e h i j k l m n o p r s t u v x), otherwise as `_b`.
5. **Chord labels.** Every chord drawn (not the wall) gets the name of its edge of G₀ in its colour, once, on the side
   of the cell that the edge enters (as a side is labelled outside the polygon, where its edge goes), a little smaller
   than the side labels.
6. **Saved sessions.** The file version goes to 4. Older files replay with the old names: `FibredSurface` gets the
   flag `legacyDefaultNames` (copied like the other legacy flags), and `Session.create`, `startSurface`,
   `buildPreset` and `initialFibredSurface` take it for building the start. Names only in G₀ and in τ never appear in
   a move, but the switches and infinitesimal branches of τ become junctions and strips of G after a cut, so they are
   legacy too.

## Decisions taken while implementing (for review)

- **BH 6.2** now starts with the stems d, x, y and the lassos γ, δ, θ. Its setup collapses d and renames y → a,
  x → c, θ → α, γ → β, δ → γ, which gives the same graph and names as before. A preset can override its setup and renames
  for older sessions (`Preset.legacy`); BH 6.2 is the only one that needs it.
- **Collisions in τ.** An infinitesimal branch skips a Greek index whose name a strip already has. That happens after
  a closed-surface move, when the polygons of Q are strips named w_α, … and a later junction is called w again.
- **The flag travels** on `TrainTrack` and `CutTrack` (`legacyDefaultNames`), and the surfaces that the closed-surface
  moves build in between carry it, so the names inside a move follow the session's format too.
- Names that are only in G₀ (built again by the remarking) are not legacy: no move refers to them.
- The e2e screenshots (`tests/e2e/app.spec.ts-snapshots`) were not updated: the Playwright browsers aren't installed
  here. They show junction names, so they probably need `npx playwright test --update-snapshots`.

## Tests

- `index`, `greekIndex`, the display of names (text and parts).
- The default names of a few gallery models (G₀ and G), and that no generated name has a digit right after a letter.
- τ: switch and infinitesimal branch names; `junctionPartName` with overflow past z.
- Chord labels in the chart decorations and in the SVG.
- A version-3 session file replays with the old names (v0, α, `b@1`, ε1).
