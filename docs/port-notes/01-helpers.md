# 01 — Helpers

**C# source:** `Assets/Scripts/Helpers/` (8 files, 756 lines)
**Target:** `src/util/` (plus pieces routed to later modules)
**Status:** ✅ approved 2026-09-24 (Q1: yes, see [design/embedding.md](../design/embedding.md); Q2, Q3: as recommended)

## Summary

`Helpers/` mixes four unrelated kinds of code:

1. **Generic utilities**: LINQ extensions, strings, numbers. → `src/util/`, **this note**.
2. **Math value types**: `Matrix3x3`, vector and complex conversions, `Rect` subtraction. → module 2 (math).
3. **Geometry that depends on `Point` and `Homeomorphism`**: `TangentVector`, `TangentSpace`. → module 3 (geometry),
   together with `Point`.
4. **Graph helpers**: `ComponentGraphs`. → module 5 (graph).

About half of the utilities become unnecessary in TypeScript, because arrays and ES2025 iterators have
them built in. Six have bugs, all in edge cases. Only one of them can plausibly be hit by the algorithm
(`GeometricMean`, see below).

---

## `EnumerableHelpers.cs` (337 lines)

The usage counts are call sites outside `Helpers/`.

### Replaced by built-ins: drop

| C# helper                            | Uses | TypeScript                                                                     |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| `ToCommaSeparatedString(sel?, sep)`  | 51   | `xs.join(", ")`, `xs.map(sel).join(", ")`                                      |
| `ToLineSeparatedString`              | 3    | `xs.join("\n")`                                                                |
| `Pop` (list)                         | 4    | `array.pop()` (returns `undefined` if the array is empty, like C#'s `default`) |
| `Enumerate`                          | 5    | `array.entries()` or `.map((x, i) => …)`                                       |
| `Deconstruct` (first two elements)   | –    | `const [a, b] = xs`                                                            |
| `FirstIndex`                         | 0    | `array.findIndex`                                                              |
| `UniqueOrdered`, `WithoutDuplicates` | 0    | `[...new Set(xs)]`                                                             |
| `ContainsDuplicates`                 | 0    | `new Set(xs).size !== xs.length`                                               |
| `EndlessLoop`, `Loop(n)`             | 3    | a 3-line `cycle()` generator, then `.take(n)`                                  |

The comment in `UniqueOrdered` asks why `Distinct()` is documented as unordered. The .NET implementation
does keep first-occurrence order, but the documentation doesn't promise it. JavaScript's `Set` _does_
guarantee insertion order, so the question goes away.

### Kept, with changes

**`argMin` / `argMax`**: replace the four functions `ArgMin`, `ArgMax`, `ArgMinIndex`, `ArgMaxIndex` (7 uses).

```ts
/** The first element minimizing `key`, with its index and value; `undefined` for an empty input. */
function argMin<T>(
  items: Iterable<T>,
  key: (item: T) => number,
): { item: T; index: number; value: number } | undefined;
```

- One function returns element, index and value, so the `…Index` variants go away.
- Returning `undefined` for an empty input (instead of `(default, float.MaxValue)`) forces callers to handle
  that case.
- **Precision:** the C# key is `float`. In `FrobeniusPerron`, the growth rate λ is taken from
  `ArgMaxIndex(c => (float)c.Real)`, so **λ is silently rounded to about 7 digits**. With `number`
  (double) this goes away.

**`rotate` / `rotateTo`**: replace the three `CyclicShift` overloads (11 uses: stars in cyclic order,
boundary words).

```ts
/** Cyclic rotation so that the element at `start` comes first. `start` is taken modulo the length. */
function rotate<T>(items: readonly T[], start: number): T[];
/** Cyclic rotation so that the first element satisfying `isFirst` comes first; unchanged if none does. */
function rotateTo<T>(items: readonly T[], isFirst: (item: T) => boolean): T[];
```

- The version that rotates to a given element becomes `rotateTo(xs, x => x === e)`. For strips, `===` is
  correct because reversed strips are unique objects (see the [porting guide](../porting-guide.md#equality-and-hashing)).
- **Bug fixed:** `CyclicShift(int shift)` doesn't reduce `shift` modulo the length, so shifting
  `[a, b, c]` by 4 returns `[a, b, c]` instead of `[b, c, a]`. It also throws `NotImplementedException` for
  negative shifts, which `ArgMaxIndex` produces (`-1`) on an empty star. `rotate` uses `mod`, and returns
  `[]` for an empty input.

**`cartesianProduct(a, b)`** (3 uses, minimum distance between all position pairs of two points in
`GeodesicSurface`): kept as a generator.

**`firstDuplicate(items, key = identity)`** (1 use, detecting duplicate edge names): kept. Keys are
strings there, so a `Set` is correct.

**`sharedPrefixLength(a, b)` and `sharedPrefix(lists)`**: renamed from `SharedInitialSegmentLength` and
`SharedInitialSegment`, since "prefix" is the usual name in TypeScript. Both compare elements with `===`
by default; an optional `equals` parameter covers other cases.

- **Bug fixed:** `SharedInitialSegment` of an _empty_ list of lists throws an `IndexOutOfRange` exception. The TypeScript
  version throws a clear `RangeError` instead, since the shared prefix of zero lists is undefined.
- **Duplicate:** `Strip.SharedInitialSegment(IReadOnlyList<Strip>)` in `Strip.cs` computes the same thing
  for the edge paths of strips. In module 6 it becomes a call to `sharedPrefixLength`.

### The "cancellation" helpers become `util/words.ts`

`ConcatWithCancellation` (two overloads), `CancellationLength` and `Inverse` work on lists of
`(T, bool)` pairs. Mathematically these are **words in a free group**: `(x, false)` is the letter x and
`(x, true)` is x⁻¹. They're used for the _side-crossing words_ of curves: the sequence of polygon
sides a curve crosses, in `FibredSurfaceMovingVertices`.

- `ConcatWithCancellation(u, v)` computes the concatenation u·v and cancels at the junction, assuming u and v are
  already reduced. The `out int cancellation` overload also returns the number of cancelled pairs.
- `CancellationLength` has 0 uses. Drop it.

Proposal:

```ts
/** A letter of a free-group word: `inverse` means the letter appears as x⁻¹. */
interface SignedLetter<T> {
  readonly letter: T;
  readonly inverse: boolean;
}
type Word<T> = readonly SignedLetter<T>[];

function invertWord<T>(w: Word<T>): Word<T>;
/** u·v with cancellation at the junction; u and v are assumed to be reduced. */
function concatReduced<T>(u: Word<T>, v: Word<T>): { word: Word<T>; cancelled: number };
```

**Trap avoided:** C# compares the `(T, bool)` tuples by value. In TypeScript, two separately created
`{ letter, inverse }` objects are never `===`, so these functions compare the fields explicitly.

**Possible unification (see Q1):** an `EdgePath` is also a word in a free group, with oriented strips as
letters, where the inverse of a letter is `strip.Reversed()`. The TypeScript word functions could take the
inverse as a parameter (`inverse: (x: L) => L`), so that side-crossing words and edge paths share one tested
implementation of reduction, inversion and cancellation.

### `GeometricMean`: bug that can be hit

```csharp
if (value <= 0)
    product *= - value; // if the value is negative, we take its absolute value
product *= value;       // ← still runs, so a negative value v contributes −v², not |v|
```

The intent is to take the absolute value, but a negative entry multiplies the product by −v², and the
following `Math.Pow(negative, 1/n)` returns **NaN**. Call sites:

- `rightEigenvector *= relativeLengths.Where(x => x > 0).GeometricMean()`: safe, the input is filtered.
- `eigenvector *= λ / eigenvector.GeometricMean()`: **not filtered.** A Perron–Frobenius eigenvector is
  non-negative in theory, but numerically it can contain tiny negative entries like −1e−17, or exact zeros for a
  reducible matrix. Those lead to NaN widths, or to a division by zero.

Proposal: `geometricMean` accepts only positive values and throws a `RangeError` otherwise. The eigenvector
code (module on transition matrices) decides explicitly how to handle zero and near-zero entries. See Q2.

---

## `StringHelpers.cs` (82 lines)

| C#                                 | Uses | TypeScript                                                                                                                                              |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WithToString`, `ObjectWithString` | 0    | drop                                                                                                                                                    |
| `AddDots(max)`                     | 1    | `truncateEnd(s, max)`. **Fix:** throws for `max < 3`; clamp instead.                                                                                    |
| `AddDotsMiddle(max, tail?)`        | 1    | `truncateMiddle(s, max, tail?)`, used only by the UI                                                                                                    |
| `ToShortString` (int, double)      | 8    | one `formatSI(x)` for `number`: `1234 → "1.23k"`, `0.002 → "2m"`, non-finite → `"?"`                                                                    |
| `ToOrdinal`                        | 3    | `ordinal(n)`. **Fix:** returns "111st", "112nd", "113rd". The test must look at `n % 100`, not `n`                                                      |
| `ReverseUpper`                     | 1    | **Moves to `fibred/`**: it is the naming convention "the inverse of edge `a` is `A`", not a string utility. **Fix:** throws for names without a letter. |

`formatSI` has to copy .NET's `"G3"` format, which drops trailing zeros (`1.5`, not `1.50`). JavaScript's
`toPrecision(3)` keeps them, so the port uses `Number(x.toPrecision(3)).toString()`.

## `NumberHelpers.cs` (34 lines)

- `Square` (29 uses) → `x ** 2`. Drop.
- `Gcd`, `Lcm` (1 use: the order of a periodic graph map, in `FibredSurfaceGraphOperations`) → `gcd`, `lcm`
  in `util/number.ts`. C# returns −1 on overflow or for non-positive inputs, and the caller checks
  `order <= 0`. The TypeScript version **throws** a `RangeError` if the result exceeds
  `Number.MAX_SAFE_INTEGER`, and the caller turns that into its existing "order too large" message.
- New: `mod(a, n)` (non-negative remainder, needed by `rotate`), `clamp`, `lerp` (replacing Unity's
  `Mathf.Clamp`/`Lerp`), `approxEqual(a, b, tolerance = 1e-3)` (replacing `ApproximateEquals` on floats).

---

## Routed to other modules

| C#                                                                                          | Goes to             | Remarks                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Matrix3x3`                                                                                 | module 2 (math)     | Column vectors `a, b, c`; in tangent spaces, `a` = tangent and `c` = normal. `Inverse()` doesn't check for `det = 0`.                                                                                                      |
| `VectorHelpers`: conversions, `Angle`, `Clamp`, `Min/Max`, `Average`, `ApproximatelyEquals` | module 2            | Methods on `Vec3`/`Complex`. Several are only used by camera code; port them when needed.                                                                                                                                  |
| `VectorHelpers.Minus(Rect, Rect, mode)`                                                     | module 2            | Splits A∖B into rectangles, used for surface chart rects. Marked "copilot"; it gets its own tests.                                                                                                                         |
| `TangentVector`, `TangentSpace`                                                             | module 3 (geometry) | Depend on `Point`. **Note:** `TangentVector +` checks `self.point != other.point`, which is _reference_ inequality, because `Point` doesn't overload `==`. So adding vectors at equal but distinct `Point` objects throws. |
| `GraphHelpers.ComponentGraphs`                                                              | module 5 (graph)    | Depends on the graph library decision.                                                                                                                                                                                     |

## Principle: port helpers when they're first needed

Only the helpers listed as "kept" above are ported now. Anything used only by the camera or UI code is
ported when that code is. That keeps the util layer small and fully used.

---

## Open questions

**Q1: Unify words.** Should side-crossing words and edge paths share one generic word implementation
(reduction, inversion, cancellation), with the inverse of a letter passed in as a function? _I recommend
yes, but decide it in module 6 (edge paths). For now, `util/words.ts` is written generically so this stays
possible._

**Q2: `GeometricMean` on eigenvectors.** When the Perron–Frobenius eigenvector has zero or tiny negative entries
(which happens for reducible transition matrices), what should the widths be? My proposal: set entries
with `|v| < 1e-12` to 0, and normalize by the geometric mean of the positive entries (like the
`rightEigenvector` line already does). _To be decided in the transition-matrix module. I only need
to know now whether the strict `geometricMean` (throwing on non-positive input) is OK._

**Q3: Tolerance.** `ApproximateEquals` uses 1e-3 in absolute terms, which was chosen for 32-bit floats. With
doubles, a tighter default such as 1e-9 would be possible, but it could change which points count as "equal"
(for example boundary points of the model polygon). _I recommend keeping 1e-3 as the default for now, and revisiting
it once the geometry is ported and tested._

## Test plan

- `iter.test.ts`: `argMin`/`argMax` (ties → first, empty → `undefined`); `rotate` (0, n, > n, negative, empty);
  `rotateTo` (found, not found); `sharedPrefix` (empty list of lists → throws, one list, no common prefix);
  `firstDuplicate`; `cycle(...).take(n)`.
- `words.test.ts`: `concatReduced` for full, partial and no cancellation; `invertWord(invertWord(w)) = w`;
  u·u⁻¹ reduces to the empty word; no hidden cancellation inside u or v.
- `number.test.ts`: `gcd`, `lcm` (including overflow → throws), `mod` with negative arguments, `geometricMean`.
- `strings.test.ts`: `formatSI` across the prefixes and boundaries (999, 1000, 0.001), `ordinal` for 1–4, 11–13,
  21, 111–113, `truncateEnd`/`truncateMiddle`.
