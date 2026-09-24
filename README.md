# Bestvina–Handel in the browser

An interactive visualization of the **Bestvina–Handel algorithm** for homeomorphisms of surfaces: fibred
surfaces, graph maps, and the algorithm's moves, drawn in 2D and on surfaces embedded in 3D.

This is a TypeScript port of the Unity project
[Surface-Mappings-Visualizer](https://github.com/p4jo/Surface-Mappings-Visualizer). **Work in progress:**
see [docs/port-notes](docs/port-notes/README.md) for the status of each module.

## Getting started

Requires Node.js 22 or newer.

```sh
npm install
npm run dev      # start the dev server
npm test         # run the tests in watch mode
npm run check    # typecheck + lint + tests, as in CI
```

## Documentation

- [Architecture](docs/architecture.md): layers, state, testing
- [Porting guide](docs/porting-guide.md): how C# constructs are translated
- [Port notes](docs/port-notes/README.md): one review document per ported module

## Tech stack

TypeScript · Vite · Vitest · three.js (rendering, planned) · Svelte (UI, planned)
