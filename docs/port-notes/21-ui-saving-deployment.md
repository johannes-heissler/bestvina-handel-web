# 21 — The UI, saving and deployment

**C# source:** `UIElements/*` (`MainMenu`, `FibredSurfaceMenu`, `SurfaceMenu`, `StartButton`, `CurveEditor`),
`Kamera/*`, `Tooltip/*` (about 2000 lines of Unity UI)
**Target:** `src/session/` (plain TypeScript), `src/ui/` (Svelte 5), `.github/workflows/`, `Dockerfile`, `deploy/`
**Status:** 🔍 new (M3 of the plan)

## The session (`src/session/`)

- **`Session`**: the start and the history as a **tree of states**, whose edges are moves (the C# history graph). Each node
  keeps its own copy of the fibred surface, so going back and branching is free.
  - `apply(move)` works on a copy and reuses a child if the same move was made before. A failing move leaves the
    history unchanged.
  - `runAutopilot` records every step as a node.
  - After a closed-surface move, the node's model becomes the ribbon graph of the new spine.
- **Map editing and renaming are moves too** (`edit map`, `rename strip`, `rename junction`), so **a session is its
  start plus its moves**. `toFile`/`fromFile` save it as JSON with a format version. Replaying skips moves that fail with a
  newer program version and reports how many.
- **Links** (`share.ts`): the JSON, deflated and in base64url, after `#s=` in the address (it never reaches a server).
- `Session.create` checks the integrity of the start, so an invalid map is refused right away.
- `describeMove` gives the labels of the history.

## The UI (`src/ui/`)

- **Layout:** a header (New, Save, Open, Copy link, one or two views, History), the views of the surface on the left,
  the algorithm on the right, and the history tree below. The panels are resizable (paneforge), and the layout is
  remembered.
- **Start dialog** (bits-ui `Dialog`):
  - examples;
  - a new surface: genus, punctures (0 = closed) and the number of peripheral punctures, plus the **gallery** of models
    with pictures. The pictures are rendered the first time and then cached in the browser, as you suggested;
  - a ribbon graph from boundary words, closed or with peripheral strips;
  - opening a file, and continuing the last session.
- **Surface view:**
  - view (standard, τ, striped), display model, curves (smooth, rounded, straight), copies (deck transformations),
    width exponent c, to scale, names;
  - **pan** (drag) and **zoom** (wheel) per view;
  - export as SVG, PDF, PNG or JPEG;
  - **hovering a strip highlights it in every view**, and in the texts.
- **Next step:** the suggestion with its options (checkboxes where several can be combined), **More choices…** (the
  variants), and the **autopilot** with the list of kinds it applies by itself (your semi-automatic mode). Buttons: _Run_
  (the chosen kinds) and _Run to the end_ (all but reducing). Below that, the history: _Start_, _Back_ (with the move),
  and the children, as in C#.
- **Graph map:** the map as editable text with the modes replace, apply after, apply before, and renaming strips.
- **State:** the result (pseudo-Anosov with λ, finite order, reducible), the growth of g, the surface, the graph, the
  reduction curves, and μ.
- **History:** the tree from the start downwards. Click a node to go there, and hover to see its move.
- **Look:** serif text on white, thin rules, small caps for headings, the C# palette. Light and dark mode follow the
  system, and the pictures stay on white paper.
- **Saving:** automatically in the browser (IndexedDB) and in the address after every change. Files are saved and opened
  from the header.

## Tests

- Unit tests for the session: copies, reuse, autopilot nodes, failing moves, save → replay, links, the model after a
  closed-surface move.
- Component tests in jsdom (`src/ui/ui.test.ts`): the state panel shows λ, and _Apply_ adds a node.
- **Playwright** (`tests/e2e/`), 5 flows in Chromium:
  - start an example and see it drawn;
  - BH 6.1 _Run to the end_;
  - a gallery model (the L);
  - apply a step and go back through the tree;
  - a session restored from its link.

  Screenshot baselines are made on the developer's machine (`npx playwright test --update-snapshots`). Fonts differ
  between systems, so CI runs the flows with `--ignore-snapshots`.

## Deployment

- `.github/workflows/deploy.yml`: check, build, and publish on **GitHub Pages** after every push to `main`. The base
  path comes from the repository variable `BASE_PATH`, which is `/` for a custom domain.
- `.github/workflows/ci.yml`: check and build, plus the Playwright flows.
- `Dockerfile`, `deploy/nginx.conf`, `deploy/k8s/app.yaml`, `.github/workflows/container.yml`: self-hosting, prepared.
- [docs/hosting.md](../hosting.md): your guide for GitHub Pages, the subdomain at checkdomain, and Hetzner/Kubernetes.

## Not yet

- Strip names after many subdivisions (`a1-1-1`, `d1+1+31`) are hard to read; a renaming scheme for the display (or
  `rename strip`) would help.
- The C# tooltips and the curve editor (drawing curves on the surface) aren't ported.
- 3D, and point pushes (after the UI, as decided).

## Update (your feedback)

- **Coloured strip names everywhere:** in the options, in the moves (`describeMove` returns structured text), in the
  history, and in the graph map.
- **The graph map is coloured text.** _Edit_ opens the editor with "edit g", "apply a map after g", "apply a map before
  g", and renaming or reversing strips.
- **Automatic steps after Apply:** the kinds ticked under "Automatic steps" (collapsible) follow every step you apply,
  so no separate _Run_ is needed. By default these are the bookkeeping steps (collapse, pull tight, valence 1 and 2,
  absorb); folds, reductions and cuts are left to you. _Run to the end_ sits next to _Apply_.
- **Panel left or right:** a button in the header.
- **History tree:** scrollable, with λ next to each state and the move (coloured) between the levels. It scrolls to
  the current state.

## Update: more information in the side panel and on hover

- **Hovering a strip** shows a card with g(e), μ(e) (in the colours of G₀), and its Perron–Frobenius width and length.
- **Side panel**, from top to bottom: next step; the graph map g and the state (always open); then collapsible
  sections (`src/session/analysis.ts` computes their contents):
  - **Transition matrix, widths, lengths** (with λ).
  - **Punctures, cusps, gates:**
    - the boundary words of G with the boundary word g maps each one to (the permutation of the punctures);
    - at each turn, the number k of infinitesimal branches of τ, marked as a cusp (k = 0 or 2, angle π) or a multicusp
      (k ≥ 3, angle (k − 1)π), with the totals;
    - the singularities (infinitesimal polygons) with their prongs;
    - P and pre-P ∖ P;
    - the gates at each junction in cyclic order.
  - **Embedding μ:** coloured in the colours of the edges of G₀, with an explanation of G₀ and μ.
- **Gates, punctures, periphery** (reordered):
  - the gates first;
  - each boundary word named B₀, B₁, …, with the number of infinitesimal branches at each turn written between its two
    letters in a second line (highlighted for cusps and multicusps), and below it the permutation g: Bᵢ ↦ Bⱼ;
  - then the layers P₀ = P, P₁, P₂, … of the pre-periphery.
- **Embedding μ:** the cyclic order of G₀ above it, and the total number of side crossings below it.

### Panel changes

- **Gates** have their own panel above the graph map (they describe the graph).
- **Punctures, periphery:** the interior angle at a turn with k infinitesimal branches is kπ (k = 1 smooth, angle π;
  k = 0 or 2 a cusp, angle 2π; k ≥ 3 a multicusp, angle kπ). The **pretrivial strips** are listed on their own and
  are not counted in the layers of the (pre-)periphery; each section is shown only when it is not empty.
- Headings are bold instead of italic; junction names are mathematical symbols (italic) in dark green.

### Result, choices shown automatically, drawing cache

- When the algorithm is finished, the panel is headed **Result** instead of "Next step", states the result (for a
  pseudo-Anosov map: efficient train-track map with efficient maximal periphery, λ, and τ connected at every junction),
  and has no Apply or "Run to the end" button, unless the result offers moves beyond it:
- **One cusp at the only puncture:** even if the surface isn't marked closed, the finished result offers the moves of
  the closed-surface case (cut along a singular leaf, or the shortcut), to see what the mapping class would be on the
  closed surface. For "Point push", cutting at v₀ (period 1) puts the puncture at that fixed singularity; the algorithm
  then finds f reducible there, with the identity on the first piece, as expected for a map isotopic to the identity
  on the closed surface (relative to a fixed point it is a point push, i.e. reducible). Known limitation: for its
  period-4 singularities the existing closed-surface moves fail ("No cut found for the singularity", or errors in the
  shortcut).
- **Choices** (formerly "More choices…"): the further choices of the selected option are computed right after the panel
  is drawn (deferred with a timeout) and listed under "Choices for the selected option"; the button is gone.
  Measured: suggestions take 1–7 ms and choices under 3 ms; the time goes into drawing (170–220 ms with 10 rounds of
  straightening and 2 copies).
- **Cache** (`ui/drawing.ts`): the layout (per surface, model and layout options, 6 per surface) and the SVG (per
  surface, model and all options, 12 per surface) are kept in weak maps keyed by the surface, so going back and forth
  in the history or switching an option back draws nothing again. The surfaces of the history are never changed in
  place, so they can be keys. A Web Worker (e.g. to show the growth after each option) is for later.
- **Choices of the option clicked last** are shown (also when several options are ticked), with "Computing…", "No
  further choices: Apply does it.", or why the option can't be applied.
- **Closed-surface options per orbit:** one cut and one shortcut per orbit of singularities (before, every junction of
  an orbit was listed). A cut is greyed out when it can't be computed: the preimage slits f⁻ʲ[L] are λ^j times shorter
  than L, up to λ^(P−1) for the period P of the prongs, and the cut works in floating point with a tolerance of 1e-9.
  Beyond λ^(P−1) ≈ 1e10 no cut is found (Point push: a period-4 orbit of 3-pronged singularities, P = 12, λ ≈ 22.5, so
  λ¹¹ ≈ 8·10¹⁴; `cutOptions` took 2.4 s to find nothing). A finer tolerance alone doesn't help (the images of the tiny
  pieces don't fit either); a real fix needs exact or rescaled arithmetic in the cut, or avoiding the tiny preimages.
