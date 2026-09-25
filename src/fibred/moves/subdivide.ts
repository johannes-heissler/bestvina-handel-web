/**
 * Subdividing a strip (the C# `SplitEdge`).
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { EdgePoint } from "../edge-point";
import type { FibredSurface } from "../fibred-surface";

/** The result of {@link subdivide}. */
export interface Subdivision {
  /** The part of the strip from its source to the new junction; the same `Edge` object as before. */
  readonly first: Edge;
  /** The part from the new junction to the old target; a new strip. */
  readonly second: Edge;
  readonly junction: Vertex;
  /**
   * Maps an edge point of the old graph map to the same point after the subdivision. Both are given along the
   * forward orientation of their strips (use {@link EdgePoint.normalized} before the move).
   */
  readonly transform: (point: EdgePoint) => EdgePoint;
}

/**
 * Subdivides the strip e at the point between the letters `gIndex − 1` and `gIndex` of g(e) (along the forward
 * orientation), with 0 < gIndex < |g(e)|. The new junction w gets g(w) = the junction between those letters.
 *
 * - The homotopy equivalence h maps e to e₁ e₂, so every letter e in every image becomes e₁ e₂ (and ē becomes ē₂ ē₁).
 * - μ is split as μ(e) = μ(e₁) | μ(e₂) after `muIndex` letters (the thesis, § "Subdivision and valence-two vertices":
 *   any split is allowed, since the position of w along the embedded strip is free). The default 0 puts w before
 *   the first side crossing.
 * - The cyclic orders: e₁ keeps the place of e at its source, e₂ the place of e at its target.
 * - A peripheral strip stays peripheral in both parts.
 * - Names follow the C# convention: `a` becomes `a1`, `a2`; `a1` becomes `a1-`, `a1+`; `a2` becomes `a2`, `a3`.
 */
export function subdivide(fs: FibredSurface, e: Edge, gIndex: number, muIndex = 0): Subdivision {
  const gImage = fs.g.image(e.forward);
  const muImage = fs.mu.image(e.forward);
  if (!(gIndex > 0 && gIndex < gImage.length))
    throw new Error(`Can't subdivide ${e} at ${gIndex}: g(${e}) has ${gImage.length} letters`);
  if (!(muIndex >= 0 && muIndex <= muImage.length))
    throw new Error(`Can't split μ(${e}) at ${muIndex}: it has ${muImage.length} letters`);
  const oldImages = new Map(fs.graph.edges.map((x) => [x, fs.g.image(x.forward)]));

  const [firstName, secondName] = segmentNames(fs, e.name.toLowerCase());
  const w = fs.addJunction();
  const second = fs.addStrip(w, e.target, {
    name: secondName,
    color: e.color,
    atTarget: { after: e.backward },
  });
  fs.graph.reattach(e.backward, w, { before: second.forward });
  e.name = firstName;
  if (fs.peripheral.has(e)) fs.peripheral.add(second);

  fs.g.setVertexImage(w, (gImage.at(gIndex) as OrientedEdge).source);
  fs.g.setImage(e.forward, gImage.slice(0, gIndex));
  fs.g.setImage(second.forward, gImage.slice(gIndex));
  const firstThenSecond = EdgePath.of(e.forward, second.forward);
  fs.g.substituteInImages((x) => (x === e ? firstThenSecond : undefined));

  fs.mu.setVertexImage(
    w,
    muIndex === 0 ? fs.mu.vertexImage(e.source) : (muImage.at(muIndex - 1) as OrientedEdge).target,
  );
  fs.mu.setImage(e.forward, muImage.slice(0, muIndex));
  fs.mu.setImage(second.forward, muImage.slice(muIndex));

  const transform = (point: EdgePoint): EdgePoint => {
    if (!point.edge.isForward) throw new Error("Transform edge points in their forward orientation");
    // Points on e move to the part they lie on; `before` is the image the index refers to.
    let [strip, index, before] = [point.edge, point.index, oldImages.get(point.edge.edge) as EdgePath];
    if (strip === e.forward && index >= gIndex)
      [strip, index, before] = [second.forward, index - gIndex, gImage.slice(gIndex)];
    else if (strip === e.forward) before = gImage.slice(0, gIndex);
    // Every earlier letter e or ē in that image became two letters.
    return new EdgePoint(strip, index + before.slice(0, index).count(e));
  };

  return { first: e, second, junction: w, transform };
}

/** The names of the two parts of a strip named `name` (the C# convention in `SplitEdge`). */
function segmentNames(fs: FibredSurface, name: string): [string, string] {
  const used = new Set(fs.graph.edges.map((x) => x.name.toLowerCase()));
  const free = (candidate: string) => !used.has(candidate) || candidate === name;
  const last = name.at(-1);
  if (last === "2") {
    const stem = name.slice(0, -1);
    return [name, [`${stem}3`, `${stem}4`].find(free) ?? fs.nextEdgeName()];
  }
  if (last === "1") return [`${name}-`, free(`${name}+`) ? `${name}+` : fs.nextEdgeName()];
  if (!free(`${name}1`)) {
    const fresh = fs.nextEdgeName();
    return [`${fresh}1`, `${fresh}2`];
  }
  return [`${name}1`, [`${name}2`, `${name}3`, `${name}2+`].find(free) ?? fs.nextEdgeName()];
}
