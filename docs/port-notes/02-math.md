# 02 — Math value types

**C# source:** `Helpers/Matrix3x3.cs`, `Helpers/VectorHelpers.cs`, and the Unity/.NET types `Vector3`,
`Vector2`, `Color`, `Color32`, `Rect`, `Mathf`, `System.Numerics.Complex`
**Target:** `src/math/` (`complex.ts`, `vec3.ts`, `mat3.ts`, `rect.ts`, `color.ts`)
**Status:** ✅ ported. Written and ported in one go (with the author's permission), so **the decisions
marked 🔍 still need review.**

## What the C# code uses

Counted in the core code (`FibredSurfaces`, `GeometricObjects_Abstract`, `Surfaces_Explicit`, `Helpers`):

- **`Complex`**: arithmetic operators, `.Real`/`.Imaginary` (56), `Magnitude`, `Phase`, `FromPolarCoordinates`,
  `Conjugate`, `ImaginaryOne`, `One`. Used for hyperbolic geodesics and Möbius transformations.
- **`Vector3`** (184 uses): arithmetic, `sqrMagnitude`, `Cross`, `Dot`, `normalized`, `magnitude`, and the constants.
- **`Vector2`** (few real uses): polygon side endpoints, bounding boxes of planes, a 2×2 matrix constructor.
- **`Mathf`**: `Clamp`, `FloorToInt`/`CeilToInt`/`RoundToInt`, `Abs`, `Atan`, `PI`, `Deg2Rad` (now in `util/number` or
  plain `Math`).
- **`Color`/`Color32`**: fixed palettes and a few constants; `ColorUtility.ToHtmlStringRGBA` for rich-text names.
- **`Rect`**: chart domains of parametric surfaces, and `VectorHelpers.Minus`.

## Decisions

**🔍 D1: no `Vec2`.** Positions are `Vec3` everywhere, as `Point.Position` is in C#. Plane models use z = 0.
Hyperbolic formulas convert to `Complex` (`v.toComplex()`, `Vec3.fromComplex(w)`). A separate `Vec2` would
mostly add conversions, since C# relied on implicit `Vector2 ↔ Vector3` conversions that TypeScript
doesn't have. _Alternative: represent all plane points as `Complex`._

**D2: immutable classes with methods.** `a.add(b).scale(2)` instead of operators. Allocating many small objects is
cheap in modern JavaScript engines; if profiling shows a hot spot (e.g. mesh generation), that code can
use plain number arrays locally.

**D3: doubles instead of floats.** All computations are 64-bit. The default tolerance stays 1e-3 (port note
01, Q3).

**D4: `Mat3` keeps the C# design:** columns `a, b, c` and the same constructors (`diagonal`, `fromRows2x2`,
`fromComplex` = the old `Complex.ToMatrix3x3`). `*` becomes `apply` (matrix·vector) and `mul` (matrix·matrix).
**Change:** `inverse()` throws a `RangeError` for singular matrices instead of returning infinities.

**🔍 D5: `InvertZ` isn't ported, and handedness changes.** Unity uses a _left-handed_ coordinate system with
the camera looking along +z. So the C# tangent bases of the plane models are (X, Y, −Z) (`Matrix3x3.InvertZ`),
with the normal pointing towards the viewer. three.js is _right-handed_, with the camera looking along −z, so
(X, Y, Z) is a positively oriented basis whose normal already points to the viewer, and c = a × b holds. The
plane models don't change (x right, y up). In the geometry module I'll use `c = a × b` throughout and
check the orientation of the 3D embeddings visually, since those could appear mirrored compared to Unity.

**D6: `Vec3.normalized()` of the zero vector is the zero vector,** as in Unity (instead of NaN).
`Vec3.angleTo` returns **radians**; Unity's `Vector3.Angle` returns degrees.

**D7: `Rect.minus`** keeps the three cut modes with the same pieces, now as a string union
(`"corners" | "horizontal" | "vertical"`). It is tested with a property test: for 500 random pairs of
rectangles and each mode, the pieces lie in A, avoid B, don't overlap, and their areas add up to
area(A) − area(A ∩ B).

**🔍 D8: colours.** `Color` stores RGBA in [0, 1], with `fromBytes` (for the old `Color32` palettes),
`fromHex`, `toHex`, `lerp` and `withAlpha`. The palettes themselves move to the modules that use them. **Rich
text** (`GetColorfulName()` produces TextMeshPro markup `<color=#…>name</color>`, and suggestion texts embed
it) should not be produced by the core any more. Proposal for the suggestion-system module: descriptions
become structured text, e.g. an array of strings and `{ label, color }` parts built by a tagged template
``rich`Fold ${a} and ${b}` ``. The UI then renders them as coloured HTML.

## Not ported (yet)

- `VectorHelpers.Clamp/Min/Max/AtLeast/AtMost/Average` on vectors: only used by camera and surface-bounds code.
  They'll be added when that code is ported.
- `Vector3.Distance`, `Angle` for `Vector2`: covered by `distanceTo`, and by `Complex.arg` and `Math.atan2`.
- `Matrix3x3.InvertZ` (see D5).

## Tests

`src/math/*.test.ts`: 28 tests. They cover the algebraic identities (A·A⁻¹ = I, (A·B)v = A(Bv), w·w⁻¹ = 1, complex
multiplication = `Mat3.fromComplex`), a right-handed cross product, the edge cases (zero vector, singular
matrix, division by zero, invalid hex) and the `Rect.minus` property test.
