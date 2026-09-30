/**
 * What to highlight in the views while a fold is selected: the strip ends whose initial segments are folded, and the
 * turns of the inefficiencies behind the fold together with their images, which the intermediate steps of removing
 * them fold (the thesis: removing an inefficiency (α, β) of order k starts by folding Dgᵏ⁻¹(α) and Dgᵏ⁻¹(β), then
 * Dgᵏ⁻²(α) and Dgᵏ⁻²(β), and so on).
 *
 * @module
 */
import type { OrientedEdge } from "../graph/ribbon-graph";
import { sharedPrefixLength } from "../util/iter";
import { EdgePoint } from "./edge-point";
import type { FibredSurface } from "./fibred-surface";
import type { Move } from "./move";
import { inCyclicOrder } from "./moves/fold";
import { foldCandidates, type Inefficiency, inefficiencyAt } from "./moves/inefficiency";

/** Strip ends at one junction whose initial segments are highlighted, with the space between them. */
export interface Wedge {
  /**
   * The strip ends by name (e.g. "a" or "A"), all starting at one junction. For a fold, all folded ends in their
   * cyclic order there (a contiguous block); for a turn, its two ends.
   */
  readonly ends: readonly string[];
  /** "fold": the fold that is selected; "turn": a turn that the later steps of removing its inefficiency fold. */
  readonly kind: "fold" | "turn";
  /** For a fold: the part of the image of each end (in order) that is folded (1: the whole strip). */
  readonly fractions?: readonly number[];
}

/** The wedges to highlight for a move (empty unless it folds). */
export function foldHighlight(fs: FibredSurface, move: Move): Wedge[] {
  const strip = (name: string) => fs.graph.orientedEdges.find((x) => x.name === name);
  const at = (ref: { strip: string; index: number }) => {
    const edge = fs.graph.edges.find((e) => e.name === ref.strip);
    return edge && inefficiencyAt(fs, new EdgePoint(edge.forward, ref.index));
  };
  let edges: OrientedEdge[];
  let behind: Inefficiency[];
  switch (move.kind) {
    case "fold":
    case "fold peripheral inefficiency": {
      const p = move.kind === "fold" && move.at ? at(move.at) : undefined;
      edges = p
        ? [...p.edgesToFold]
        : move.strips.map(strip).filter((x): x is OrientedEdge => x !== undefined);
      if (edges.length < 2) return [];
      const i = p?.initialSegment ?? commonLength(fs, edges);
      // All inefficiencies whose removal starts with this fold (the option stands for all of them).
      const candidate = foldCandidates(fs).find(
        (c) => c.initialSegment === i && sameEnds(c.edgesToFold, edges),
      );
      behind = (candidate?.places ?? []).flatMap((place) => {
        const [name, index] = place.split("@") as [string, string];
        const q = at({ strip: name, index: Number(index) });
        return q ? [q] : [];
      });
      if (p && behind.length === 0) behind = [p];
      return [foldWedge(fs, edges, i), ...turnWedges(fs, behind, edges)];
    }
    case "remove inefficiency": {
      const p = at(move.at);
      if (p === undefined || p.edgesToFold.length < 2) return [];
      return [foldWedge(fs, p.edgesToFold, p.initialSegment), ...turnWedges(fs, [p], p.edgesToFold)];
    }
    default:
      return [];
  }
}

function foldWedge(fs: FibredSurface, edges: readonly OrientedEdge[], i: number): Wedge {
  let ordered: OrientedEdge[];
  try {
    ordered = inCyclicOrder(fs, edges);
  } catch {
    ordered = [...edges];
  }
  return {
    ends: ordered.map((e) => e.name),
    kind: "fold",
    fractions: ordered.map((e) => Math.min(1, i / Math.max(1, fs.g.image(e).length))),
  };
}

/**
 * The turns (Dgʲ(α), Dgʲ(β)) for j = 0, …, k − 2 of the inefficiencies: those folded after the selected fold (which
 * folds the turn for j = k − 1). Each turn once, and none that is the selected fold itself.
 */
function turnWedges(fs: FibredSurface, found: readonly Inefficiency[], folded: readonly OrientedEdge[]): Wedge[] {
  const seen = new Set<string>([key(folded)]);
  const wedges: Wedge[] = [];
  for (const p of found) {
    let [a, b] = [p.point.dgBefore(fs), p.point.dgAfter(fs)];
    for (let j = 0; j < p.order - 1 && a !== undefined && b !== undefined; j++) {
      const k = key([a, b]);
      if (!seen.has(k) && a !== b) {
        seen.add(k);
        wedges.push({ ends: [a.name, b.name], kind: "turn" });
      }
      [a, b] = [fs.g.derivative(a), fs.g.derivative(b)];
    }
  }
  return wedges;
}

const key = (ends: readonly OrientedEdge[]) =>
  ends
    .map((e) => `${e.edge.id}${e.isForward ? "+" : "-"}`)
    .sort()
    .join(",");

const sameEnds = (x: readonly OrientedEdge[], y: readonly OrientedEdge[]) => key(x) === key(y);

/** The length of the common prefix of the images of `edges`. */
function commonLength(fs: FibredSurface, edges: readonly OrientedEdge[]): number {
  return Math.min(
    ...edges.slice(1).map((e) => sharedPrefixLength(fs.g.image(edges[0] as OrientedEdge), fs.g.image(e))),
  );
}
