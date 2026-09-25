# 11 — Collapsing invariant subforests

**C# source:** `FibredSurfaceCollapseSubforests.cs` (264 lines), `OrbitOfEdge` in `FibredSurfaceGraphOperations.cs`
**Target:** `src/fibred/moves/collapse-forest.ts`
**Status:** 🔍 ported

## What the C# code does

- **Finding invariant subforests:** for each strip e, the orbit of e (e plus all strips in the images of strips of
  the orbit, repeatedly) is the smallest g-invariant subgraph containing e. If it is a forest and **periphery-friendly**
  (each component contains at most one junction of P, so collapsing doesn't destroy P), it is a candidate. Only
  maximal candidates are kept.
- **Collapsing:** for each component T, the user picks a centre p (in the "in steps" mode; the default is a junction of
  largest valence). `PullTowardsCenter` then walks the tree recursively from p. Each strip leaving T gets its
  image prolonged by the image of the tree path, is reattached to p, and receives a float order index squeezed in
  between the existing ones, so that the cyclic order at p comes out right. Finally the forest strips are
  deleted from all images and junction images are redirected to the centres.
- A comment notes that the forest doesn't need to be invariant, because the images are prolonged, so removing a
  valence-2 junction is a special case.

### Problems found

1. `IsPeripheryFriendlySubforest` **ignores its `peripheralSubgraph` parameter** and always iterates the junctions of
   the stored P. Also, it reads `componentIntersections[comp]` even when the junction isn't in the forest (then
   `comp` is 0). That's harmless, but wrong.
2. The cyclic order at the centre is maintained through float order indices (`orderIndexWidth`, `scale * index`),
   with a runtime check that throws if the result is not what the recursion expected.

## The port

The collapse is the homotopy equivalence h that maps each tree T to its centre p. A strip end e leaving T at x
becomes e′ = [p → x]_T · e:

- **g:** g(e′) = g([p → x]_T) · g(e); then the forest strips are deleted from all images, and junctions mapped into T
  are mapped to p. That is h ∘ g ∘ h⁻¹, and it is correct whether or not the forest is invariant.
- **μ (new):** μ(e′) = μ([p → x]_T) · μ(e), reduced. This is the isotopy that contracts T to p, from the thesis
  section "Collapsing invariant subforests and isotopy".
- **Cyclic order:** the new star of p is `graph.starOfSubgraph(p, T)` (port note 05), computed before the change and
  set afterwards. That replaces the recursion and the float indices (problem 2).
- **The choice of centre** is a callback `chooseCenter(candidates)`. The candidates are sorted by valence, as in C#. The
  suggestion system can ask the user through it. The move itself doesn't need the generator side channel.
- `isPeripheryFriendlyForest(fs, edges, { periphery?, touching? })` uses the periphery it is given (fixing problem 1).
  C#'s `remove` option (removing P's edges from the set first) is left out until a caller needs it.

## Tests

`src/fibred/moves/collapse-forest.test.ts` (8 tests), on the torus rose with a = x y subdivided:

- the orbit of an edge; finding the invariant forest {y} when g(y) is a point; finding none for the Anosov map;
- periphery-friendliness, including a custom periphery (problem 1) and a loop (not a forest);
- collapsing {y} towards v or towards m: both give x ↦ x, b ↦ b x b, with μ(x′) = x y;
- collapsing the _non_-invariant forest {y} of the Anosov map: the same result as removing the valence-2 junction
  (a ↦ ab, b ↦ bab);
- rejecting a set of edges that isn't a forest.

All results pass `checkIntegrity()`, including the boundary words under μ.
