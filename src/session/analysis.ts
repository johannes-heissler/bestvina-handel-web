/**
 * What the side panel shows about a state, beyond the graph map: the transition matrix with widths and lengths, the
 * boundary words (punctures) with how g permutes them and their cusps, the (pre-)periphery, and the gates at each
 * junction. Plain data, so that it can be tested without the UI.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "../fibred/fibred-surface";
import { findGates } from "../fibred/gates";
import { perronFrobenius } from "../fibred/perron-frobenius";
import { trainTrack } from "../fibred/train-track";

export interface MatrixInfo {
  readonly strips: readonly Edge[];
  /** entries[i][j]: how often strip i occurs in g(strip j). */
  readonly entries: readonly (readonly number[])[];
  readonly growth: number | undefined;
  readonly widths: ReadonlyMap<Edge, number>;
  readonly lengths: ReadonlyMap<Edge, number>;
}

export function matrixInfo(fs: FibredSurface): MatrixInfo {
  const strips = fs.graph.edges;
  const matrix = fs.g.transitionMatrix(strips, strips);
  try {
    const pf = perronFrobenius(fs, { essentialOnly: false });
    return { strips, entries: matrix.entries, growth: pf.growth, widths: pf.widths, lengths: pf.lengths };
  } catch {
    return { strips, entries: matrix.entries, growth: undefined, widths: new Map(), lengths: new Map() };
  }
}

/** A turn of a boundary word of G, seen in τ: how many infinitesimal branches the boundary of τ passes there. */
export interface Turn {
  /** The strip arriving at the junction and the one leaving it. */
  readonly from: OrientedEdge;
  readonly to: OrientedEdge;
  readonly infinitesimal: number;
  /**
   * Smooth (1 infinitesimal branch), a cusp with interior angle π (0 or 2), or a multicusp with interior angle
   * (k − 1)π (k ≥ 3 infinitesimal branches).
   */
  readonly kind: "smooth" | "cusp" | "multicusp";
}

export interface BoundaryWordInfo {
  readonly word: readonly OrientedEdge[];
  /** The index of the boundary word that g maps it to (−1 if none, i.e. g is not geometric). */
  readonly image: number;
  /** The turns with their cusps, if τ is available. */
  readonly turns: readonly Turn[] | undefined;
}

export interface BoundaryInfo {
  readonly words: readonly BoundaryWordInfo[];
  /** The infinitesimal polygons of τ: singularities with that many prongs. */
  readonly singularities: readonly { readonly junction: Vertex; readonly prongs: number }[];
  /** Why τ couldn't be built, if it couldn't. */
  readonly problem?: string;
}

export function boundaryInfo(fs: FibredSurface): BoundaryInfo {
  const words = fs.graph.boundaryWords();
  const report = fs.g.boundaryWordReport();
  let turnsOf: (word: readonly OrientedEdge[]) => Turn[] | undefined = () => undefined;
  let singularities: { junction: Vertex; prongs: number }[] = [];
  let problem: string | undefined;
  try {
    const tt = trainTrack(fs);
    const stripOf = new Map<Edge, Edge>([...tt.realBranch].map(([strip, branch]) => [branch, strip]));
    const tauWords = tt.boundaryWords();
    singularities = tauWords
      .filter((b) => b.infinitesimal)
      .map((b) => ({
        junction: tt.junctionOf.get((b.word.first as OrientedEdge).source) as Vertex,
        prongs: b.word.length,
      }));
    // Each boundary word of G is a boundary word of τ with infinitesimal branches inserted at its turns.
    const turnsByFirstLetter = new Map<OrientedEdge, Turn[]>();
    for (const b of tauWords) {
      if (b.infinitesimal) continue;
      const letters = b.word.letters;
      const reals = letters.flatMap((x, i) => (tt.kind.get(x.edge) === "real" ? [i] : []));
      const toStrip = (x: OrientedEdge) => {
        const strip = stripOf.get(x.edge) as Edge;
        return x.isForward ? strip.forward : strip.backward;
      };
      const turns = reals.map((i, r) => {
        const j = reals[(r + 1) % reals.length] as number;
        const k = (j - i - 1 + letters.length) % letters.length;
        const kind: Turn["kind"] = k === 1 ? "smooth" : k >= 3 ? "multicusp" : "cusp";
        return {
          from: toStrip(letters[i] as OrientedEdge),
          to: toStrip(letters[j] as OrientedEdge),
          infinitesimal: k,
          kind,
        };
      });
      if (turns[0]) turnsByFirstLetter.set(turns[0].from, turns);
    }
    turnsOf = (word) => {
      // Rotate the turns of τ's word to start where the word of G starts.
      for (const [first, turns] of turnsByFirstLetter) {
        const k = word.indexOf(first);
        if (k >= 0 && turns.length === word.length)
          return [...turns.slice(word.length - k), ...turns.slice(0, word.length - k)];
      }
      return undefined;
    };
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  return {
    words: words.map((w, i) => ({
      word: w.letters,
      image: report[i]?.matchedIndex ?? -1,
      turns: turnsOf(w.letters),
    })),
    singularities,
    ...(problem !== undefined && { problem }),
  };
}

/** The gates at each junction, in the cyclic order of its star. */
export function gatesInfo(fs: FibredSurface): { junction: Vertex; gates: OrientedEdge[][] }[] {
  const gateOf = new Map<OrientedEdge, number>();
  findGates(fs.graph, fs.g).forEach((gate, i) => gate.edges.forEach((x) => gateOf.set(x, i)));
  return fs.graph.vertices.map((v) => {
    const star = fs.graph.star(v);
    // Start after a change of gate, so that no gate is split across the end of the list.
    const start = star.findIndex(
      (x, i) => gateOf.get(x) !== gateOf.get(star[(i - 1 + star.length) % star.length] as OrientedEdge),
    );
    const ordered = start <= 0 ? star : [...star.slice(start), ...star.slice(0, start)];
    const gates: OrientedEdge[][] = [];
    for (const x of ordered) {
      const last = gates.at(-1);
      if (last && gateOf.get(last[0] as OrientedEdge) === gateOf.get(x)) last.push(x);
      else gates.push([x]);
    }
    return { junction: v, gates };
  });
}

/** The strips of the periphery P and of the pre-periphery (eventually mapped into P) outside P. */
export function peripheryInfo(fs: FibredSurface): { peripheral: Edge[]; prePeripheral: Edge[] } {
  const pre = fs.prePeriphery();
  return {
    peripheral: fs.graph.edges.filter((e) => fs.peripheral.has(e)),
    prePeripheral: fs.graph.edges.filter((e) => pre.has(e) && !fs.peripheral.has(e)),
  };
}
