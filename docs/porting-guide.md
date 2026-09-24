# C# → TypeScript porting guide

Conventions for translating the Unity/C# code. Each rule notes the **trap** it avoids, where there is one.

## Collections and LINQ

| C#                                   | TypeScript                                           |
| ------------------------------------ | ---------------------------------------------------- |
| `List<T>`, `T[]`, `IReadOnlyList<T>` | `T[]`, `readonly T[]`                                |
| `Dictionary<K, V>`, `HashSet<T>`     | `Map<K, V>`, `Set<T>` (**see Equality below**)       |
| `.Select / .Where / .Any / .All`     | `.map / .filter / .some / .every`                    |
| `.First(p)` / `.FirstOrDefault(p)`   | `.find(p)` (returns `undefined` if nothing matches)  |
| `.Aggregate`, `.Sum`                 | `.reduce`                                            |
| `.SelectMany`                        | `.flatMap`                                           |
| `.ToList()`, `.ToArray()`            | `Array.from(it)` / `it.toArray()`                    |
| `.ToDictionary(k, v)`                | `new Map(xs.map(x => [k(x), v(x)]))`                 |
| `.GroupBy(k)`                        | `Map.groupBy(xs, k)`                                 |
| `.Take / .Skip` on lazy sequences    | iterator helpers `.take / .drop`                     |
| `.Distinct()`                        | `[...new Set(xs)]` (keeps first-occurrence order)    |
| `string.Join(", ", xs)`              | `xs.join(", ")` (calls `toString()` on each element) |
| `yield return` / `IEnumerable<T>`    | `function*` / `Iterable<T>`                          |
| `Enumerable.Range(0, n)`             | `range(n)` from `util/iter`, or a plain `for` loop   |

**Default to arrays.** Most C# chains end in `.ToList()` anyway, and arrays are easier to debug. Use
generators with iterator helpers only where laziness matters: infinite sequences or early exit over
expensive elements.

**Trap: iterators are single-use.** In C#, a LINQ query stored in a variable runs again every time it is
enumerated. A JavaScript iterator (a generator or `.values().map(...)`) is **used up after one pass**, and
a second pass silently sees nothing. If a C# variable of type `IEnumerable<T>` is enumerated more than once,
turn it into an array in TypeScript.

## Equality and hashing

**Trap:** `Map` and `Set` compare keys by **reference** (`===`). C# overrides of `Equals`/`GetHashCode`
have no effect on them.

- **Prefer objects that are unique by construction.** The C# code already does this for strips:
  `UnorientedStrip.Reversed()` caches its `ReverseStrip`, so each oriented edge exists as exactly one
  object, and reference equality is correct. Keep this pattern.
- Where values must be compared by content (for example junctions by `id`, or edge paths by their
  sequence of strips), give the type an explicit `equals(other)` method, and key maps by a primitive
  (`junction.id`, a string key) instead of the object.
- `==` on C# class types that don't overload `operator ==` is reference equality. Check which one the C# code
  means before choosing `===` or `.equals()`.

## Classes and language features

| C#                                             | TypeScript                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `partial class FibredSurface` (20 files)       | One class with the state and basic queries; each move in its own module of functions `move(fs, …)` |
| `out var x`, `ref x`                           | Return an object `{ result, x }` or a tuple                                                        |
| `struct` with value semantics (`Vector3`)      | Immutable class (`readonly` fields, methods return new instances)                                  |
| Operator overloading (`a * z + b`)             | Methods: `a.mul(z).add(b)`                                                                         |
| Implicit conversions (`Point p = someVector3`) | Explicit factory calls: `new BasicPoint(v)`                                                        |
| `enum`                                         | String-literal union type: `type RectCutMode = "corners" \| "vertical" \| "horizontal"`            |
| `record`                                       | Class with `readonly` fields, or a `readonly` interface for plain data                             |
| Properties with logic (`get`/`set`)            | Getters where cheap and side-effect free; otherwise a method                                       |
| `null`, `default(T)`                           | `undefined` (use `null` only if both "absent" and "empty" must be told apart)                      |
| Extension methods                              | Free functions in the matching `util/` or `math/` module                                           |
| Unity `Debug.Log*`                             | `console.*` for developer logs; user-visible errors go through the `onError` flow                  |

## Numbers

- **Trap: integer division.** In C#, `int / int` truncates (`7 / 2 == 3`). In TypeScript it doesn't
  (`7 / 2 === 3.5`). Translate it as `Math.trunc(a / b)`.
- `%` is the remainder in both languages (the sign follows the dividend). For a mathematical `mod`, use
  `mod(a, n)` from `util/number`.
- Unity's `Vector3` and `Mathf` work in 32-bit `float`. TypeScript always uses 64-bit doubles. Results
  therefore differ slightly, and golden tests use tolerances.
- `long` arithmetic that could overflow (orders of periodic maps) must stay within
  `Number.MAX_SAFE_INTEGER` (≈ 9·10¹⁵), or use `bigint`.

## Naming and style

- Everything in English: code, comments, docs, commit messages.
- Mathematical Greek letters as identifiers (`λ`, `ε`) are fine where they match the paper's notation.
- File names in kebab-case (`edge-path.ts`), types in PascalCase, functions and variables in camelCase.
- Every exported function or class has a TSDoc comment that says **what** it means mathematically, not only
  what it computes.
