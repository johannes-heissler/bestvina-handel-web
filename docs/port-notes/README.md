# Port notes

One review document per C# module, written **before** the module is ported. Each note:

1. **Explains** what the C# code does, and why, in mathematical terms.
2. **Lists** what it depends on and who uses it.
3. **Flags** bugs, dead code and unclear spots.
4. **Proposes** simplifications for the TypeScript version.
5. **Asks** open questions that need the author's decision.
6. **Plans** the tests.

The author reviews and answers the note. The port then follows the approved note, and the note stays as a
record of the design decisions. User-facing documentation of each module lives in its TSDoc comments and
in `docs/`.

## Status

✅ approved · 🔍 ported, decisions awaiting review · ✍️ note awaiting review

| #   | Module                                                         | C# files                                            | Note | Port | Tests |
| --- | -------------------------------------------------------------- | --------------------------------------------------- | ---- | ---- | ----- |
| 0   | Scaffold                                                       | –                                                   | –    | ✅   | ✅    |
| 1   | [Helpers](01-helpers.md)                                       | `Helpers/*`                                         | ✅   | ✅   | ✅    |
| 2   | [Math value types](02-math.md)                                 | `Matrix3x3`, `VectorHelpers`, Unity types           | 🔍   | ✅   | ✅    |
| 5   | [Ribbon graph](05-graph.md)                                    | QuikGraph, `GraphHelpers`, cyclic order in `Strip`  | 🔍   | ✅   | ✅    |
| 6   | [Edge paths and combinatorial maps](06-edge-paths-and-maps.md) | `EdgePath`, `Strip.EdgePath`, `TransitionMatrix`, … | ✍️   |      |       |
| 7+  | One note per `FibredSurface` move                              | `FibredSurfaces/FibredSurface*.cs`                  |      |      |       |
| 3   | Curves, points, geodesics                                      | `GeometricObjects_Abstract/*`                       |      |      |       |
| 4   | Surfaces, homeomorphisms                                       | `GeometricObjects_Abstract/*`                       |      |      |       |
| …   | Embedding layer, suggestion system, examples, rendering, UI    |                                                     |      |      |       |

Modules 3 and 4 (geometry) come after the combinatorial core; see [05-graph.md](05-graph.md#change-of-the-module-order).
