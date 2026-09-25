# 07 — `FibredSurface` core and the suggestion system

**C# source:** `FibredSurface.cs`, `FibredSurfaceNamesAndColors.cs`, `FibredSurfacePeripheralSubgraphs.cs`, the
integrity checks and the suggestion protocol in `FibredSurfaceAlgorithmSuggestionSystem.cs`
**Target:** `src/fibred/fibred-surface.ts`, `src/fibred/names-and-colors.ts`; later `src/fibred/suggestions.ts`
**Status:** core 🔍 ported; the suggestion system ✍️ is a **proposal** (it gets ported with the first moves)

## What the C# code does

`FibredSurface` is a `partial class` spread over about 20 files. The core holds:

- the QuikGraph graph, the model surface (for curves), the peripheral subgraph P (one loop around each
  puncture except one orbit), the flags `ignoreBeingReducible` and `isTrainTrack`, and an `OnError` event;
- a constructor from curve descriptions, which also infers the vertex images from the first letters of the edge
  images, and a `Copy()` for branching;
- names and colours for new strips and junctions: the first unused name from fixed lists, the least used
  colour from a palette;
- the pre-periphery P ∪ P₁ ∪ P₂ ∪ ⋯ (edges eventually mapped into P) and the essential subgraph H (the rest);
- `CheckIntegrityOfGraphMap`, run after every applied suggestion: continuity of the images, loops mapped to
  vertices, duplicate names, vertex images consistent with Dg, the back-references between graph and
  strips, "edges with the same Dg are adjacent at their junction", and consistency of the curves' jump points.

### Problems found

1. `Copy()` doesn't copy `isTrainTrack` (only `ignoreBeingReducible`).
2. The adjacency check builds a `HashSet<EdgePath>` of the first letters of the images. `EdgePath` doesn't override
   `GetHashCode`, so the set contains one entry per edge instead of one per letter, and the check runs
   repeatedly. The result is correct, it just does redundant work.
3. The list of edge names contains μ, σ and λ, which now denote the inverse marking, the cyclic order and the
   growth rate.

## The ported core

`FibredSurface` (`src/fibred/fibred-surface.ts`) holds **G, g, μ and P** plus the two flags. It doesn't contain
any moves: each move is a module of functions that change a `FibredSurface` in place (see the
[porting guide](../porting-guide.md)).

- **`FibredSurface.fromText(boundaryWords, map, peripheral?)`** builds G from its boundary words and g from text.
  Useful for tests and examples.
- **Default μ:** if none is given, **G₀ is a copy of the initial graph and μ is the identity onto it**. That is exactly
  "the carrying map with respect to the spine used as input to the algorithm" from the thesis. The examples
  module will pass the rose dual to the polygon instead.
- **`copy()`** copies G, g, μ and P. G₀ is shared, because no move changes it. The flags and the error handler
  are copied too (fixing problem 1).
- **`addJunction` / `addStrip`** pick the next free name and the least used colour. **`removeStrip` /
  `removeJunction`** also remove the images from g and μ and the edge from P. So the moves can't forget to update one of
  them.
- **`prePeripheralLayers()`, `prePeriphery()`, `essentialSubgraph()`**: as in C#.
- **`checkIntegrity(): string[]`** returns all problems instead of reporting only the first one. It checks the stars,
  the continuity of g **and μ**, loops mapped to a point, duplicate names (edges and, new, vertices), and the
  adjacency of edges with the same Dg (fixing problem 2). New: **μ must map every boundary word of G to a boundary
  word of G₀** ([design/embedding.md](../design/embedding.md)). The checks of curves and back-references are
  gone, because those no longer exist.
- **`reportInconsistency(message)`** replaces `HandleInconsistentBehavior`. The handler `onError` defaults to
  `console.error`, and the UI sets its own.
- 🔍 **Names:** μ, σ and λ are removed from the list of edge names (problem 3).

## 🔍 Proposal: the suggestion system

### How it works in C#

`NextSuggestion()` returns the first applicable suggestion in a fixed priority order:

1. collapse invariant subforests, 2. pull tight, 3. remove valence-1 junctions, 4. absorb into the periphery,
2. detect finite order, 6. detect reducibility (unless ignored), 7. remove valence-2 junctions, 8. remove
   peripheral inefficiencies, 9. remove inefficiencies, 10. convert to a train track.

A suggestion is a description, a list of options `(object, string)`, and a list of **buttons as strings**.
`ApplySuggestion(options, button)` is a large `switch` over the button texts, which casts the option objects back
to what the move needs (`IEnumerable<string>`, `FibredGraph`, serialized `EdgePoint`s…). Moves that run
"in steps" are `IEnumerator`s. Between steps they read the user's choice from the two fields
`selectedOptionsDuringAlgorithmPause` and `selectedButtonDuringAlgorithmPause`. While such a run is active, the
surface can't be copied (`Copyable`).

### Proposal

- **Typed suggestions.** Each move defines its own suggestion type, e.g.
  `{ kind: "collapseSubforests", forests: EdgeNames[][], actions: ["atOnce", "inSteps"] }`. `applySuggestion`
  then `switch`es over `kind` with full type checking. There are no string buttons and no casts. The UI maps
  `kind` + action to its labels.
- **Options refer to strips and junctions by name.** The UI applies a suggestion to a _copy_ of the surface (to
  keep the history), so options must not hold object references into the original. C# solves this with names
  and serialization strings. The port does the same, but typed: `{ edge: "a", index: 3 }` instead of `"a@3"`.
  Names survive `copy()`.
- **Runs "in steps":** prefer **stateless re-suggestion**. After one step, the next suggestion is simply computed
  from the new state (e.g. "fold the next pair"). This keeps every intermediate state copyable, which is good for
  the history. Only where a move really needs data carried from step to step does it become a generator that
  receives the choice through `yield` (`const choice = yield suggestion;`). That replaces the two side-channel fields.
  I'll decide this per move in its note.
- **Descriptions become structured text** (strings plus `{ strip }` / `{ junction }` references) that the UI
  renders with colours, instead of TextMeshPro markup (port note 02, D8).
- **Autopilot:** `runAlgorithm(fs, maxSteps)` applies the first option and first action of each suggestion, as
  `BestvinaHandelAlgorithm()` does.

## Tests

`src/fibred/fibred-surface.test.ts` (12 tests): building from text with μ = identity onto a copy, independent copies
(sharing G₀ and keeping P and the flags), names and colours of new strips and junctions, removing strips from all
of G, g, μ and P, and each integrity check detecting its problem (a loop mapped to a point, duplicate names,
non-adjacent edges with the same Dg, a broken μ, missing images). The pre-periphery layers are checked on an
example with P = {p}, g(q) = p, g(r) = q p.
