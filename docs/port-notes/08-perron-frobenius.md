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

## Update (2026-10-19): without a full eigen-decomposition

The eigen-decomposition (`EigenvalueDecomposition` of ml-matrix, the QR algorithm of JAMA) computes all eigenvalues and
eigenvectors of M and of Mᵀ, in O(n³) each. Two problems showed up after the closed-surface moves:

- **It can hang.** Its QR iteration has no iteration limit and doesn't converge for some matrices: a near-permutation
  matrix with a zero column (g maps most strips to single strips, one to the empty path) kept it running for hours.
- **It is slow where only λ is needed.** The suggestion "move vertices" computes λ for every junction and every first
  letter of its images on a copy (O(n) candidates, so O(n⁴) per suggestion): 52 % of the time after a cut.

M is non-negative, so the Perron–Frobenius theory gives simpler, always convergent methods:

1. **λ = ρ(M), the spectral radius,** is the largest of the spectral radii of the diagonal blocks of the strongly
   connected components of M (the graph with an arrow e → f when f occurs in g(e)); a component of a single strip that
   doesn't occur in its own image has ρ = 0. A block B of a component is irreducible, so B + I is primitive: its
   Perron eigenvalue ρ(B) + 1 is simple and strictly larger in modulus than all its other eigenvalues (the shift by I
   is what breaks the tie for periodic blocks, like a permutation, whose eigenvalues all lie on a circle). The power
   iteration x ← (B + I) x / ‖(B + I) x‖, from x = (1, …, 1), converges to the Perron vector, and for every positive x
   the Collatz–Wielandt bounds min (Bx)ᵢ/xᵢ ≤ ρ(B) ≤ max (Bx)ᵢ/xᵢ enclose ρ(B); the iteration stops when they agree to
   10⁻¹³ (relatively). It only needs products with the sparse block, and can't run forever (it also has a cap).
2. **The eigenvectors** (widths and lengths) by inverse iteration with the shift λ′ = λ + δ just above λ (δ = 10⁻⁹ ·
   max(λ, 1)): x ← (λ′ I − M)⁻¹ x, normalized, from x = (1, …, 1), a few times. Since λ′ > ρ(M), the inverse is the
   Neumann series Σ Mᵏ / λ′ᵏ⁺¹, a non-negative matrix, so x stays non-negative; it multiplies the components of the
   eigenvalue λ by 1/δ and the others by at most 1/(λ′ − |μ|), so x converges to a non-negative eigenvector for λ,
   also when λ is multiple or has a Jordan block (reducible matrices, e.g. a ↦ a, b ↦ b a). This takes one LU
   decomposition (Gaussian elimination, which always terminates) of M and one of Mᵀ.
3. **`growthRate(fs, …)`** computes step 1 only, for the callers that need only λ (the candidates of "move vertices").

The tolerance for zero entries, the sign and the scalings stay as they are.

## Tests

`src/fibred/perron-frobenius.test.ts` (4 tests): the Anosov map a ↦ ab, b ↦ bab (λ = φ², both eigenvectors
∝ (1, φ), both normalizations); a periodic map (λ = 1, equal widths); the non-diagonalizable reducible map
a ↦ a, b ↦ b a (finite, non-negative weights, where C# would fail); and the restriction to the essential subgraph.
