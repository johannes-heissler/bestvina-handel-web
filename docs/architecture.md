# Architecture

This app is a browser port of the Unity project
[Surface-Mappings-Visualizer](https://github.com/p4jo/Surface-Mappings-Visualizer). It visualizes the
Bestvina–Handel algorithm for homeomorphisms of surfaces: it builds a fibred surface (a graph with a
thickening) together with a graph map, and applies the algorithm's moves one at a time until it reaches an
efficient representative.

## Layers

The code is split into layers. **A layer may only import from the layers above it in this list.** ESLint
enforces the most important rule: nothing outside `render/` and `ui/` may import three.js or rendering/UI
code.

| Folder           | Contents                                                                                                                  | C# origin                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/util/`      | Generic helpers: iteration, strings, numbers, words with cancellation. No geometry.                                       | `Helpers/EnumerableHelpers`, `StringHelpers`, `NumberHelpers`                            |
| `src/math/`      | Value types: `Complex`, `Vec3`, `Mat3`, `Rect`, `Color`.                                                                  | `Helpers/Matrix3x3`, `VectorHelpers`, Unity `Vector3`/`Color`, `System.Numerics.Complex` |
| `src/geometry/`  | Surfaces, points, curves, geodesics, homeomorphisms, tangent vectors.                                                     | `GeometricObjects_Abstract/*`, `Helpers/Tangent*`                                        |
| `src/graph/`     | A small undirected multigraph, used for the fibred surface's graph.                                                       | QuikGraph, `Helpers/GraphHelpers`                                                        |
| `src/fibred/`    | Junctions, strips, edge paths, combinatorial maps (g and μ), gates, and the `FibredSurface` moves.                        | `FibredSurfaces/*`                                                                       |
| `src/examples/`  | Construction of surfaces and example maps from parameters.                                                                | `Surfaces_Explicit/SurfaceGenerator`                                                     |
| `src/embedding/` | Layout: derives vertex positions and edge curves from the combinatorics (see [design/embedding.md](design/embedding.md)). | new, replaces the curves stored on strips                                                |
| `src/render/`    | three.js scene: curves as ribbons/tubes, surfaces as meshes, picking.                                                     | `GeometricObjects_Visualization/*`, `Kamera/*`                                           |
| `src/ui/`        | Svelte components: menus, algorithm history, graph-map editor.                                                            | `UIElements/*`, `Tooltip/*`                                                              |

Everything from `util/` to `embedding/` is **headless**: plain TypeScript that runs in Node without a
browser. That keeps the mathematical core fully unit-testable.

## State and mutation

As in the C# code, the algorithm's moves change a `FibredSurface` **in place**. Branching (exploring
several suggestions) works on copies. The UI does not watch objects for changes. Instead, it re-reads
what it displays after each move, triggered by a version counter that the UI bumps whenever it applies a
move. So the domain classes need no framework-specific reactivity.

## Testing

- **Unit tests** (Vitest) sit next to the code as `*.test.ts`.
- **Invariant checks**: the C# code checks consistency after each move (`HandleInconsistentBehavior`). The
  port keeps these checks and also runs them in tests.
- **Golden tests** compare against the C# implementation. A small exporter in the Unity project writes the
  graph map after each step of an example run to JSON. The TypeScript run must reproduce the same
  sequence (up to tolerances for floating-point geometry).

Run everything with `npm run check`.
