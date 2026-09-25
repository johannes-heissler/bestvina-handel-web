/**
 * Removing junctions of valence 1 and 2 (the C# `FibredSurfaceValence1and2Junctions`). Both moves are
 * homotopy equivalences h : G → G′ that collapse one strip; g becomes h ∘ g ∘ h⁻¹, and μ becomes μ ∘ h⁻¹.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { perronFrobenius } from "../perron-frobenius";

/** The junctions with exactly one strip end. */
export function valenceOneJunctions(fs: FibredSurface): Vertex[] {
  return fs.graph.vertices.filter((v) => fs.graph.valence(v) === 1);
}

/**
 * Removes a junction v of valence 1 together with its strip e (from v to w), i.e. collapses e into w.
 *
 * - g: the letters e and ē are deleted from all images, and junctions mapped to v are mapped to w.
 *   (Images entering v must leave it right away, so they contain ē e, and the result stays continuous.)
 * - μ: unchanged. G′ is a subgraph of G, and h⁻¹ is the inclusion.
 */
export function removeValenceOneJunction(fs: FibredSurface, v: Vertex): void {
  const star = fs.graph.star(v);
  if (star.length !== 1) throw new Error(`The junction ${v} has valence ${star.length}, not 1`);
  const e = star[0] as OrientedEdge;
  const w = e.target;

  fs.g.substituteInImages((edge) => (edge === e.edge ? EdgePath.EMPTY : undefined));
  redirectVertexImages(fs, v, w);
  fs.removeStrip(e.edge);
  fs.removeJunction(v);
}

/** The junctions of valence 2 whose two strip ends don't belong to the same loop. */
export function valenceTwoJunctions(fs: FibredSurface): Vertex[] {
  return fs.graph.vertices.filter((v) => {
    const star = fs.graph.star(v);
    return star.length === 2 && star[0] !== star[1]?.reversed;
  });
}

/**
 * Removes a junction v of valence 2. Of its two strips r and k (oriented away from v), r is removed and
 * k is extended across v: the new k′ runs along r̄ k from the other end u of r.
 *
 * - The homotopy equivalence h collapses r into u (v ↦ u) and maps k to k′.
 * - g: g(k′) = g(r)⁻¹ g(k), then the letters r and r̄ are deleted from all images, and junctions mapped to v
 *   are mapped to u.
 * - μ: μ(k′) = μ(r)⁻¹ μ(k), reduced; all other images stay the same.
 * - The cyclic order: k′ takes the place of r̄ in the star of u, and keeps its place at its other end.
 *
 * @param removed The strip end at v to remove. By default, a strip in the pre-periphery, or otherwise the one
 *   with the larger Perron–Frobenius width (as in C#).
 */
export function removeValenceTwoJunction(fs: FibredSurface, v: Vertex, removed?: OrientedEdge): void {
  const star = fs.graph.star(v);
  const [s0, s1] = star as [OrientedEdge, OrientedEdge];
  if (star.length !== 2) throw new Error(`The junction ${v} has valence ${star.length}, not 2`);
  if (s0 === s1.reversed) throw new Error(`The junction ${v} only has the loop ${s0.edge}`);
  if (removed !== undefined && removed !== s0 && removed !== s1)
    throw new Error(`${removed} is not a strip end at ${v}`);

  const r = removed ?? defaultStripToRemove(fs, s0, s1);
  const k = r === s0 ? s1 : s0;
  const u = r.target;

  // New images of k′ = r̄ k, computed from the old maps.
  fs.g.setImage(k, fs.g.image(r).inverse.concat(fs.g.image(k)));
  fs.mu.setImage(k, fs.mu.image(r).inverse.concatReduced(fs.mu.image(k)).path);

  // Move the start of k from v to u, in the place of r̄.
  fs.graph.reattach(k, u, { after: r.reversed });
  if (k.edge.name.toLowerCase().startsWith(r.edge.name.toLowerCase())) k.edge.name = r.edge.name;

  fs.g.substituteInImages((edge) => (edge === r.edge ? EdgePath.EMPTY : undefined));
  redirectVertexImages(fs, v, u);
  fs.removeStrip(r.edge);
  fs.removeJunction(v);
}

/**
 * The C# choice of the strip to remove at a valence-2 junction: a strip in the pre-periphery, otherwise the one
 * with the larger Perron–Frobenius width. Pass `widths` to reuse them when removing several junctions (computing them
 * is the expensive part on large graphs).
 */
export function defaultStripToRemove(
  fs: FibredSurface,
  s0: OrientedEdge,
  s1: OrientedEdge,
  widths: ReadonlyMap<Edge, number> = perronFrobenius(fs, { essentialOnly: true }).widths,
): OrientedEdge {
  const prePeriphery = fs.prePeriphery();
  if (prePeriphery.has(s0.edge)) return s0;
  if (prePeriphery.has(s1.edge)) return s1;
  const width = (e: Edge) => widths.get(e) ?? 0;
  return width(s0.edge) > width(s1.edge) ? s0 : s1;
}

/** Junctions that g maps to `from` are mapped to `to` instead. */
function redirectVertexImages(fs: FibredSurface, from: Vertex, to: Vertex): void {
  for (const x of fs.graph.vertices)
    if (x !== from && fs.g.vertexImage(x) === from) fs.g.setVertexImage(x, to);
}
