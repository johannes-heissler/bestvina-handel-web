# 13 — Inefficiencies, and the algorithm without user interaction

**C# source:** `Inefficiency.cs` (91 lines), `FibredSurfaceEssentialInefficiencies.cs` (180 lines),
`FibredSurfacePeripheralInefficiencies.cs` (38 lines), `NextSuggestion` / `ApplyNextSuggestion` /
`BestvinaHandelAlgorithm` in `FibredSurfaceAlgorithmSuggestionSystem.cs`
**Target:** `src/fibred/moves/inefficiency.ts`, `src/fibred/algorithm.ts`
**Status:** 🔍 ported

## Inefficiencies

An **inefficiency** is a point inside an image g(e) where g turns illegally: the strips a (before the turn,
reversed) and b (after it) lie in the same gate, so Dgᵏ(a) = Dgᵏ(b) for a smallest k, the **order**. Order 0 is a
backtrack. To lower the order, the strips at the junction of Dgᵏ⁻¹(a) and Dgᵏ⁻¹(b) whose images start with the common
prefix of g(Dgᵏ⁻¹(a)) and g(Dgᵏ⁻¹(b)) are folded along that prefix. (That's the C# default
`AlwaysFoldAllEdgesWithShortSharedInitialSegment = false`, "cooler since the initial segment is longer"; the variant
from [BH] is dead code in C# and not ported.)

**Removing** an inefficiency repeats: fold, follow the point through the subdivisions and folds, and check that it is now
an inefficiency of order k − 1. At order 0, pull tight. Two special cases, as in C#:

- If the strips to fold are the whole star, the junction is extremal: pull it tight instead.
- The folded prefix is shortened while a subdivision point would coincide with the inefficiency point itself. If it becomes
  empty, the common first strip c (or its first Dg-iterate whose image is longer than one letter) is subdivided after
  its first letter, and then one letter is folded.

**Peripheral inefficiencies:** strips at a junction with the same Dg in the pre-periphery are folded along their common
prefix.

### Changes

- `inefficiencies(fs)` finds each illegal turn once by scanning the images, with a gate lookup, instead of trying every
  pair of each gate against every image (C# `InefficientConcatenations`). The order of the suggestions is the same (by order,
  full folds first).
- Following the point uses the `transform`s of the moves (port note 12) instead of shared mutable `updateEdgePoints`
  lists.
- In the special case above, the strips to fold and the chain of strips to subdivide are followed through the
  subdivisions (a strip end at the target of a subdivided strip now belongs to its second part). C# kept references to
  strips that the subdivision had replaced.
- The choice of fold (μ-path c and kept strip) is a callback, by default the option with the fewest side crossings, as the
  C# default `movementsOrdered[0]`.
- If folding doesn't lower the order, `reportInconsistency` is called (C# threw an exception).

## The algorithm without user interaction

`nextStep(fs)` returns the first applicable step in the C# priority order, with its default choices:

1. collapse an invariant subforest,
2. pull tight,
3. remove a valence-1 junction,
4. remove valence-2 junctions (stopping as soon as an invariant subforest appears),
5. fold a peripheral inefficiency,
6. remove an inefficiency (at once).

`runAlgorithm(fs)` applies steps until none applies, and **checks the integrity after every step** (throwing with the
problems otherwise).

**Not ported yet:** absorbing into the periphery, detecting finite order, detecting reducibility (and reducing), and
converting into a train track. They sit between steps 3 and 4 in the C# order, and will be added there.

## Tests

- `src/fibred/moves/inefficiency.test.ts` (6 tests): the order of a turn (order 2 in the example), backtracks and legal turns,
  each illegal turn listed once, one removal step lowering the order by one, a complete removal without increasing the
  growth, and a peripheral inefficiency.
- `src/fibred/algorithm.test.ts` (4 tests), **end to end:**
  - an efficient map needs no step;
  - the Anosov map a ↦ aba, b ↦ ba conjugated by a (growth (3 + √13)/2 ≈ 3.30) reaches the efficient representative with
    growth φ², with no reported inconsistency;
  - a conjugation by b is pulled tight, reaching φ²;
  - Dehn twists on the genus-2 surface.

In the example, removing _only_ inefficiencies lowers the growth monotonically (3.30 → 2.83 → 2.70 → 2.65 → …) but piles up
valence-2 junctions whose images have length 1. It reaches φ² only when interleaved with the other moves, as the algorithm
does.
