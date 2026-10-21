# 30 — Veering triangulations of the mapping torus

**Source:** not in the C# code. Agol, *Ideal triangulations of pseudo-Anosov mapping tori* (2011); the implementation
follows the idea of A. Issa's Master's thesis (*Veering triangulations and the Bestvina–Handel algorithm*, Melbourne, Python
code in `bestvina-handel-external/Veering`), but is written from scratch. A prototype exists in
`scripts/cut-study/veering.ts`, `veering-cohomology.ts` (branch `cut-study`), where it was used to study the endless cut
chain.
**Target:** `src/three-manifold/` (new layer: triangulations of the mapping torus), `src/three-manifold/veering.ts`,
`src/three-manifold/cohomology.ts`; later a view in `src/ui`.
**Status:** 📝 draft (2026-10-20), prototype working; nothing ported yet

## What it does

For a pseudo-Anosov φ that the algorithm found (an efficient train-track map with growth λ > 1), it builds Agol's
**veering triangulation** of the mapping torus of φ on S° (the surface with every singularity and every puncture
removed). This triangulation is canonical: it depends only on the fibred face of the class of φ, not on φ itself. Two maps
whose triangulations are combinatorially isomorphic are monodromies of the same 3-manifold in the same fibred face.

## The construction (as prototyped)

1. **Trivalent track.** τ is combed at every switch with more than one branch end on a side (merge the first two ends
   into a new branch; a switch with one end on each side is dissolved). The widths of `train-track.ts` become weights;
   they satisfy the switch equations.
2. **Duality.** A trivalent measured track whose complementary regions are once-punctured polygons is the same as an
   ideal triangulation of S° (one triangle per switch, one edge per branch) with positive edge weights, such that in
   each triangle one weight (the *large* edge) is the sum of the other two.
3. **Cusps as labels.** Every triangle has one *cusp* corner (between its two small edges). Splitting keeps the cusps
   of the complementary regions, so a triangle is identified by its cusp. φ acts on the cusps; the action is computed
   from g_τ by reducing the images of the boundary words of τ and reading off where the cusp turns land.
4. **Maximal splits.** All edges of maximal weight are flipped at once (they are pairwise disjoint). The flip of e in the
   quadrilateral with sides a, b, c, d (in cyclic order) gives w(e′) = max(w(a) + w(c), w(b) + w(d)) − w(e); the cusps go
   to the new triangles as computed in the code (two cases, which are also the two veering colours).
5. **Period.** After each maximal split, the triangulation (triangle by cusp label, neighbours across its edges, weights)
   is compared with every earlier one under the cusp map φ: equal with all weights scaled by 1/λ means T_{n+m} = φ(T_n).
6. **Layers.** One tetrahedron per flip in [n, n + m): bottom faces the two old triangles, top faces the two new ones. The
   last layer is glued to the first by the cusp map (cusp corner to cusp corner, orientation kept). A triangle can
   survive several periods; its gluing then follows φ⁻¹ until it dies, and the number of periods it wraps around is the
   value of the fibre cocycle on that face.

Checks: every face glued once; number of edges = number of tetrahedra; every edge is the bottom diagonal of exactly
one tetrahedron and the top diagonal of exactly one (taut); the veering colouring exists; SnapPy finds a hyperbolic
structure with all tetrahedra positive.

## Output and use

- SnapPea triangulation text (readable by SnapPy), later also Regina's isomorphism signature (needs our own encoder).
- The number of tetrahedra, cusps (one per orbit of punctures and of singularities), edge degrees.
- H¹ over ℚ, the fibre class, the directed cycles of the dual graph and the fibred cone they define, isomorphisms between
  two triangulations (to compare stages of a computation, e.g. the cut chain).
- In the UI: a "3-manifold" panel with these numbers; a census lookup would need SnapPy (server side or Pyodide), so
  that stays optional.

## Questions for the author

1. **Arithmetic.** The prototype uses floating point with a relative tolerance of 1e-9 for equal weights. Ties are
   genuine equalities, so this works in practice; for a certificate the weights could be kept in ℤ[λ] (the minimal
   polynomial is known from `poly.mjs`) with comparisons by interval arithmetic. Do it now or later?
2. **Where:** a new layer `src/three-manifold/` (imports `fibred/`, nothing imports it back), or inside `fibred/`?
3. **Taut polynomial.** Computing the taut polynomial of the triangulation (Landry–Minsky–Taylor; equal to McMullen's
   Teichmüller polynomial for layered triangulations) would give λ for every class in the face at once. It is a
   module computation over ℤ[H₁/torsion]; worth a note of its own?
4. **Conventions.** Vertices A, B, C, D of a tetrahedron are the corners of the flipped quadrilateral (bottom diagonal BD,
   top diagonal AC); faces 0 and 2 are bottom faces. Keep these, or follow SnapPy's orientation convention from the start?

## Tests

- The once-punctured torus maps (Floyd–Hatcher: the triangulation of the monodromy RᵃLᵇ… has one tetrahedron per letter).
- Taut and veering for all examples; SnapPy agreement for a handful (volume, homology) recorded as data.
- Invariance: conjugating the map gives an isomorphic triangulation; the k-th power gives the k-fold cyclic cover (k times
  as many tetrahedra).
- The cut chain of "Point push with Dehn twists": 26 tetrahedra and isomorphic triangulations from the second stage on.
