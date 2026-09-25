# 08 — Transition matrix, growth rate and weights

**C# source:** `FibredSurfaceTransitionMatrixAndWeights.cs` (77 lines)
**Target:** `src/fibred/perron-frobenius.ts` (the transition matrix itself is `CombinatorialMap.transitionMatrix`,
module 06)
**Status:** 🔍 ported

## What the C# code does

`FrobeniusPerron(essentialSubgraph, out λ, out widths, out lengths, out matrix)` builds the transition matrix M
(of all strips, or only of the essential subgraph H), computes a full eigen-decomposition with MathNet, and
takes the eigenvalue with the largest real part as the growth rate λ:

- **widths** = the eigenvector column (M w = λ w), sign-normalized by its first entry and scaled so that its
  geometric mean is λ;
- **lengths** = the corresponding row of the _inverse_ eigenvector matrix, i.e. the left eigenvector (l M = λ l),
  scaled so that the lengths are comparable with the image lengths |g(e)|.

It is used for the growth rate and the type (pseudo-Anosov if λ > 1 + 10⁻⁶) in `GraphString`, and to choose which
strip to remove at a valence-2 junction.

### Problems found

1. **λ is rounded to `float`** (`ArgMaxIndex(c => (float)c.Real)`, port note 01).
2. **`GeometricMean` bug:** the widths are divided by the geometric mean of the _unfiltered_ eigenvector, which
   gives NaN for tiny negative entries (port note 01).
3. **The left eigenvector comes from inverting the eigenvector matrix**, which fails when the matrix is not
   diagonalizable (e.g. g = a ↦ a, b ↦ b a has the Jordan block (1 1; 0 1)).
4. The sign is normalized by the first entry, which fails if that entry is 0 (reducible matrices).
5. Naming: the variable `rightEigenvector` actually holds the _left_ eigenvector (and is used for the lengths).

## The port

- `perronFrobenius(fs, { essentialOnly })` returns `{ growth, widths, lengths, matrix }`, with the weights as
  `Map<Edge, number>`.
- 🔍 **New dependency: `ml-matrix`** for the eigen-decomposition of general real matrices (replacing MathNet).
- The left eigenvector is computed as an eigenvector of Mᵀ (fixing 3). Signs are normalized by the sum of the
  entries (fixing 4), and negative or relatively tiny entries (< 10⁻¹² · max) are set to 0. The geometric means are
  taken over positive entries only (fixing 2), and everything is double precision (fixing 1). This was Q2 of port note 01.
- The normalizations of the widths and lengths are the same as in C#.

## Tests

`src/fibred/perron-frobenius.test.ts` (4 tests): the Anosov map a ↦ ab, b ↦ bab (λ = φ², both eigenvectors
∝ (1, φ), both normalizations); a periodic map (λ = 1, equal widths); the non-diagonalizable reducible map
a ↦ a, b ↦ b a (finite, non-negative weights, where C# would fail); and the restriction to the essential subgraph.
