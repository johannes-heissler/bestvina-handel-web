# Bestvina–Handel in the browser

An interactive visualization of the **Bestvina–Handel algorithm** for homeomorphisms of surfaces: fibred surfaces,
graph maps and the algorithm's moves, drawn on model surfaces (ideal and compact hyperbolic polygons, flat
translation surfaces, the punctured plane, ribbon graphs).

It is a TypeScript port of the Unity project
[Surface-Mappings-Visualizer](https://github.com/p4jo/Surface-Mappings-Visualizer). See
[docs/port-notes](docs/port-notes/README.md) for the status of each module.

**Online:** <https://johannes-heissler.github.io/bestvina-handel-web/> (see [docs/hosting.md](docs/hosting.md)).

## What it does

- Start from an example (Bestvina–Handel's examples 6.1–6.3, point pushes, a closed genus-2 surface, …), from a surface
  of any genus and number of punctures with a choice of models, or from a ribbon graph given by its boundary words.
- Step through the algorithm: every step is suggested with its options (and further choices, e.g. how to fold), or let
  the autopilot run, for all kinds of steps or only some. Every state is kept in a history tree.
- Classification: pseudo-Anosov (with λ), finite order, or reducible (with a choice of the pieces to continue on).
- Views: the standard view, the train track τ in the junctions, and the striped view of f(F) ⊆ F; Poincaré, Klein or
  upper half-plane; copies of the polygon by deck transformations; export as SVG, PDF, PNG or JPEG.
- Sessions are saved in the browser, can be downloaded as a file, and shared as a link.

## Getting started

Requires Node.js 22 or newer.

```sh
npm install
npm run dev        # start the dev server
npm test           # unit and component tests in watch mode
npm run check      # typecheck (TypeScript and Svelte) + lint + tests, as in CI
npm run test:e2e   # the browser tests (Playwright; run `npx playwright install chromium` once)
```

## Documentation

- [Architecture](docs/architecture.md): layers, state, testing
- [Design: combinatorial maps and the embedding](docs/design/embedding.md)
- [Port notes](docs/port-notes/README.md): one review document per module
- [Hosting](docs/hosting.md): GitHub Pages, custom domain, self-hosting

## Tech stack

TypeScript · Vite · Vitest · Svelte 5 (with bits-ui and paneforge) · SVG for the 2D views · Playwright · three.js for
the 3D views (planned)
