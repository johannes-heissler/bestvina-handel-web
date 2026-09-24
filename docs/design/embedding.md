# Design: combinatorial maps and the embedding

**Status:** agreed on 2026-09-24. This changes the design of the C# original on purpose.

## Two combinatorial maps

The algorithm state consists of a ribbon graph G (the spine of the fibred surface F) and two
combinatorial maps defined on it:

| Map        | Meaning                                                                                | C# original                                                         |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| g : G → G  | Carrying map of the homeomorphism f.                                                   | `Strip.EdgePath`                                                    |
| μ : G → G₀ | Inverse marking: how the embedding of G in the surface is carried by a fixed spine G₀. | Not stored. Recomputed from the curves as `Curve.SideCrossingWord`. |

G₀ is a fixed reference ribbon graph that comes with the model surface. In the model we use (a complete,
finite-area hyperbolic surface given as an ideal polygon with side pairings, with all punctures at the ideal
vertices), G₀ is the **rose dual to the polygon sides**. Then μ(e) is exactly the word of sides that the
edge e crosses.

Background: the author's thesis, § "Keeping track of the embedding" and § "Reconstructing f from g".

### Scope decisions

- **No punctures inside the polygon.** The flat torus with interior punctures is dropped.
- G₀ is stored explicitly (not implied by the polygon), so it could later differ from the dual graph,
  e.g. by adding lassos. Nothing below relies on G₀ being a rose, except the geometric layout (§ 3).
- **Peripheral lassos:** the loop around a cusp crosses a side, so its μ is non-trivial. The stem that
  connects the loop to the rest of the graph stays inside the polygon, so its μ is **trivial** (a
  pretrivial edge).

## 1. `CombinatorialMap`: one class for both maps

A `CombinatorialMap<E, F>` maps each oriented edge of a source graph (letters of type `E`) to an edge
path in a target graph (letters of type `F`). g is a `CombinatorialMap<Strip, Strip>`, and μ is a
`CombinatorialMap<Strip, Spine0Edge>`.

It owns everything that only depends on "edge ↦ edge path":

- image of an edge, of a reversed edge (the inverse path), and of a whole edge path;
- concatenation with and without cancellation, reduction, pulling tight (removing backtracking);
- the transition matrix (square for g, non-square for μ); for μ, the sum of its entries is the total number
  of side crossings;
- the derivative Dg (the first letter of each image) and gates;
- preservation of boundary words (see the check below);
- composition, and later factoring into collapses, subdivisions and folds.

`FibredSurface` then holds the graph G, g and μ, and the moves update both maps.

## 2. How the moves update μ

Most moves come with a homotopy equivalence h : G → G′. The marking updates as m′ = h ∘ m, and μ is
updated by factoring **μ = μ′ ∘ h**, the same way g is updated to g̃. The basic operation is an
**isotopy of a vertex** v along a path γ in G₀:

> μ(e) ← reduce(γ̄ · μ(e)) for each edge e leaving v (and correspondingly at the end of edges
> entering v; loops get both).

| Move                                   | Update of μ                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Remove a valence-2 vertex              | μ(e) = μ(e₁) · μ(e₂) (reduced)                                                          |
| Subdivide e = e₁e₂                     | Choose a split μ(e) = μ(e₁) \| μ(e₂). The split index is a parameter.                   |
| Collapse a forest                      | Isotopy that contracts each component: μ(e) ← μ([p → o(e)] · e), p the preferred vertex |
| Fold a and b                           | Isotope first so that μ(a) and μ(b) agree on the folded part, then fold μ like g.       |
| Split an edge into two parallel copies | Both copies get μ(e); their left/right order follows from the ribbon structure.         |

**Choices** (where to split μ(e); in a full-full fold, whether to move t(a) or t(b)) are offered as several
suggestions, as in the C# program. Minimizing the total number of side crossings is a sensible default.

**Check after every move:** μ must map each boundary word of G to a boundary word of G₀, up to cyclic
reduction. By the theorem in "Reconstructing f from g", this is exactly the condition for μ to come from an
embedding.

**Later (not in the port):** suggest homotopies of μ that reduce the number of side crossings or a
growth-like quantity of μ's transition matrix, as a "pulling tight for μ".

## 3. Geometry is derived, not stored

Strips and junctions carry **no geometry**. A separate layer `src/embedding/`, between `fibred/` and
`render/`, computes curves from (G, cyclic orders, μ, polygon):

1. **Order of crossings along each side.** Every occurrence of a letter d in some μ(e) is a _strand_
   through side d. Two strands are compared by following both paths forward until they diverge; the cyclic
   order of the polygon sides then decides which one is on the left. If a strand reaches a vertex of G first,
   continue along the boundary path (turn to the neighbour in the cyclic order at that vertex), using the
   ribbon structure of G. If μ comes from an embedding, this order is unique.
2. **Crossing points** are spread along each side in that order. Later they can be spaced by the train
   track widths.
3. **Vertex positions** come from a barycentric (Tutte) layout in the **Klein model**, where hyperbolic
   geodesics are straight lines and the polygon is convex. So chords between crossing points don't cross, and
   each vertex lies in the convex region that its neighbours bound.
4. **Curves** are paths through the waypoints: o(e), c₁, c₁′, …, t(e) (where cᵢ′ is the same crossing seen from the
   paired side), with smoothing (`GetPathFromWaypoints`).

The layout is recomputed after every move. `ShiftedCurve` is no longer needed for edges, because parallel
strands already have separate crossing points.

The other direction also remains available: μ of a user-drawn geodesic path is its side-crossing word,
which is easy to compute from its segments.

## Effect on the port

- Geometry code in the moves (`Restrict`, `Concatenate`, `ShiftedCurve`, `AdjustStartVector`, junction
  patches, `Curve.SideCrossingWord`) is not ported.
- A strip's name and colour move from its curve to the strip itself.
- Golden tests compare g, μ and names with the C# version, but not curves.
