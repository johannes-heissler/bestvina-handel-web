/**
 * The track τ defined from g (the thesis, Move "Graph smoothing", § "Constructing the train track"), with its
 * carrying map g_τ and the widths of its branches.
 *
 * τ is built for any g, also one that is not a train-track map yet: then illegal turns simply get no
 * infinitesimal branch. So the display can always draw the junctions as small disks containing the
 * infinitesimal branches, and doesn't need an explicit "convert to train track" move (which in C# added
 * all infinitesimal branches as strips).
 *
 * @module
 */
import { Matrix, solve } from "ml-matrix";
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { type Edge, type OrientedEdge, RibbonGraph, type Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";
import { findGates, reducedDerivative } from "./gates";
import { perronFrobenius } from "./perron-frobenius";

/** A branch of τ is either a real branch (a strip of G) or an infinitesimal branch inside a junction. */
export type BranchKind = "real" | "infinitesimal";

/** A boundary word of τ with its number of cusps; see {@link TrainTrack.boundaryWords}. */
export interface TrackBoundaryWord {
  readonly word: EdgePath;
  /** True for the boundary of an infinitesimal polygon (only infinitesimal branches), i.e. a singularity. */
  readonly infinitesimal: boolean;
  /** The number of cusps: turns between two branches on the same side of a switch. */
  readonly cusps: number;
}

export interface TrainTrack {
  /** τ as a ribbon graph: switches are its vertices, branches its edges. */
  readonly graph: RibbonGraph;
  /** The carrying map g_τ : τ → τ. */
  readonly gTau: CombinatorialMap;
  readonly kind: ReadonlyMap<Edge, BranchKind>;
  /** The real branch of each strip of G. */
  readonly realBranch: ReadonlyMap<Edge, Edge>;
  /** The switch of the gate of each strip end of G. */
  readonly switchOf: ReadonlyMap<OrientedEdge, Vertex>;
  /** The junction of G containing each switch. */
  readonly junctionOf: ReadonlyMap<Vertex, Vertex>;
  /** The growth rate λ of g. */
  readonly growth: number;
  /**
   * Widths of all branches: the Perron–Frobenius widths on the real branches, extended to the infinitesimal
   * ones (the thesis, § "Assigning widths and lengths on τ"). Only defined if λ > 1.
   */
  readonly widths: ReadonlyMap<Edge, number> | undefined;
  /**
   * Lengths of all branches: the Perron–Frobenius lengths on the real branches (so that the length of g_τ(e) is λ
   * times the length of e), 0 on the infinitesimal ones.
   */
  readonly lengths: ReadonlyMap<Edge, number>;
  /** The boundary words of τ with their cusps. */
  boundaryWords(): TrackBoundaryWord[];
}

/** Builds τ, g_τ and the widths from a fibred surface. */
export function trainTrack(fs: FibredSurface): TrainTrack {
  const g = fs.g;
  const tau = new RibbonGraph();
  const kind = new Map<Edge, BranchKind>();
  const realBranch = new Map<Edge, Edge>();
  const switchOf = new Map<OrientedEdge, Vertex>();
  const junctionOf = new Map<Vertex, Vertex>();

  // Switches: one per gate, in the cyclic order of the gates at each junction.
  const gateSwitches = new Map<Vertex, Vertex[]>(); // junction → its switches in cyclic order
  const gates = findGates(fs.graph, g);
  const gateOfEnd = new Map<OrientedEdge, number>();
  gates.forEach((gate, i) => gate.edges.forEach((e) => gateOfEnd.set(e, i)));
  const switchOfGate = new Map<number, Vertex>();
  for (const v of fs.graph.vertices) {
    const star = fs.graph.star(v);
    // Start at a boundary between two gates, so that each gate forms one block.
    const k = Math.max(
      0,
      star.findIndex(
        (e, i) =>
          gateOfEnd.get(e) !== gateOfEnd.get(star[(i - 1 + star.length) % star.length] as OrientedEdge),
      ),
    );
    const switches: Vertex[] = [];
    for (const e of [...star.slice(k), ...star.slice(0, k)]) {
      const gate = gateOfEnd.get(e) as number;
      if (!switchOfGate.has(gate)) {
        const s = tau.addVertex(`${v.name}.${switches.length}`, v.color);
        switchOfGate.set(gate, s);
        junctionOf.set(s, v);
        switches.push(s);
      }
      switchOf.set(e, switchOfGate.get(gate) as Vertex);
    }
    gateSwitches.set(v, switches);
  }

  // Real branches: one per strip.
  for (const e of fs.graph.edges) {
    const branch = tau.addEdge(switchOf.get(e.forward) as Vertex, switchOf.get(e.backward) as Vertex, {
      name: e.name,
      color: e.color,
    });
    kind.set(branch, "real");
    realBranch.set(e, branch);
  }
  const branchEnd = (e: OrientedEdge) => {
    const branch = realBranch.get(e.edge) as Edge;
    return e.isForward ? branch.forward : branch.backward;
  };

  // Infinitesimal branches: pairs of gates crossed by a turn of g, closed under Dg* (which skips pretrivial edges,
  // like the gates).
  const dg = reducedDerivative(fs.graph, g);
  const derivativeSwitch = (s: Vertex): Vertex | undefined => {
    const end = [...switchOf].find(([, t]) => t === s)?.[0];
    const d = end === undefined ? undefined : dg(end);
    return d === undefined ? undefined : switchOf.get(d);
  };
  const infinitesimal = new Map<string, OrientedEdge>(); // key "s|t" in both directions
  const addInfinitesimal = (s: Vertex, t: Vertex): OrientedEdge | undefined => {
    if (s === t) return undefined; // an illegal turn: no infinitesimal branch
    const existing = infinitesimal.get(`${s.id}|${t.id}`);
    if (existing !== undefined) return existing;
    const branch = tau.addEdge(s, t, { name: `ε${kind.size - fs.graph.edgeCount + 1}`, color: s.color });
    kind.set(branch, "infinitesimal");
    infinitesimal.set(`${s.id}|${t.id}`, branch.forward);
    infinitesimal.set(`${t.id}|${s.id}`, branch.backward);
    return branch.forward;
  };
  const queue: [Vertex, Vertex][] = [];
  for (const e of fs.graph.edges) {
    const letters = g.image(e.forward).letters;
    for (let i = 1; i < letters.length; i++)
      queue.push([
        switchOf.get((letters[i - 1] as OrientedEdge).reversed) as Vertex,
        switchOf.get(letters[i] as OrientedEdge) as Vertex,
      ]);
  }
  for (let pair = queue.shift(); pair !== undefined; pair = queue.shift()) {
    const [s, t] = pair;
    if (s === t || infinitesimal.has(`${s.id}|${t.id}`)) continue;
    addInfinitesimal(s, t);
    const [ds, dt] = [derivativeSwitch(s), derivativeSwitch(t)];
    // Skipping a pretrivial letter can lead to switches at different junctions: that is no turn of G (only one in
    // the quotient by the pretrivial forest), so it gives no branch.
    if (ds !== undefined && dt !== undefined && junctionOf.get(ds) === junctionOf.get(dt))
      queue.push([ds, dt]);
  }

  // Cyclic order at each switch: its real branch ends in the order of the star, then the infinitesimal
  // branches towards the following gates in the cyclic order of the gates.
  for (const [v, switches] of gateSwitches) {
    const star = fs.graph.star(v);
    switches.forEach((s, j) => {
      const real = star.filter((e) => switchOf.get(e) === s);
      const first = real.find((e) => switchOf.get(fs.graph.previous(e)) !== s) ?? real[0];
      const realInOrder =
        first === undefined ? [] : fs.graph.starFrom(first).filter((e) => switchOf.get(e) === s);
      const others = [...switches.slice(j + 1), ...switches.slice(0, j)];
      const inf = others.flatMap((t) => infinitesimal.get(`${s.id}|${t.id}`) ?? []);
      tau.setStar(s, [...realInOrder.map(branchEnd), ...inf]);
    });
  }

  // The carrying map g_τ.
  const gTau = new CombinatorialMap(tau, tau);
  for (const s of tau.vertices) gTau.setVertexImage(s, derivativeSwitch(s) ?? s);
  for (const e of fs.graph.edges) {
    const letters = g.image(e.forward).letters;
    const path: OrientedEdge[] = [];
    letters.forEach((x, i) => {
      if (i > 0) {
        const turn = infinitesimal.get(
          `${(switchOf.get((letters[i - 1] as OrientedEdge).reversed) as Vertex).id}|${(switchOf.get(x) as Vertex).id}`,
        );
        if (turn !== undefined) path.push(turn);
      }
      path.push(branchEnd(x));
    });
    gTau.setImage(branchEnd(e.forward), EdgePath.from(path));
  }
  for (const [branch, k] of kind) {
    if (k !== "infinitesimal") continue;
    const [ds, dt] = [derivativeSwitch(branch.source), derivativeSwitch(branch.target)];
    const image = ds !== undefined && dt !== undefined ? infinitesimal.get(`${ds.id}|${dt.id}`) : undefined;
    gTau.setImage(branch.forward, image === undefined ? EdgePath.EMPTY : EdgePath.of(image));
  }

  // Widths.
  const pf = perronFrobenius(fs, { essentialOnly: false });
  const widths =
    pf.growth > 1 + 1e-9 ? branchWidths(tau, gTau, kind, realBranch, pf.widths, pf.growth) : undefined;

  const lengths = new Map<Edge, number>(tau.edges.map((branch) => [branch, 0]));
  for (const [strip, branch] of realBranch) lengths.set(branch, pf.lengths.get(strip) ?? 0);

  const boundaryWords = (): TrackBoundaryWord[] =>
    tau.boundaryWords().map((word) => {
      const letters = word.letters;
      let cusps = 0;
      letters.forEach((x, i) => {
        const y = letters[(i + 1) % letters.length] as OrientedEdge;
        if (kind.get(x.edge) === kind.get(y.edge)) cusps++; // both on the same side of the switch t(x) = o(y)
      });
      return { word, infinitesimal: letters.every((x) => kind.get(x.edge) === "infinitesimal"), cusps };
    });

  return {
    graph: tau,
    gTau,
    kind,
    realBranch,
    switchOf,
    junctionOf,
    growth: pf.growth,
    widths,
    lengths,
    boundaryWords,
  };
}

/**
 * Extends the widths w_G of the real branches to the infinitesimal ones: w_inf = (λ − M_inf)⁻¹ · M_{G→inf} · w_G,
 * where M_inf is the permutation matrix of g_τ on the infinitesimal branches and M_{G→inf} counts how often
 * g_τ(e) crosses each infinitesimal branch.
 */
function branchWidths(
  tau: RibbonGraph,
  gTau: CombinatorialMap,
  kind: ReadonlyMap<Edge, BranchKind>,
  realBranch: ReadonlyMap<Edge, Edge>,
  stripWidths: ReadonlyMap<Edge, number>,
  λ: number,
): Map<Edge, number> {
  const widths = new Map<Edge, number>();
  for (const [strip, branch] of realBranch) widths.set(branch, stripWidths.get(strip) ?? 0);
  const inf = tau.edges.filter((e) => kind.get(e) === "infinitesimal");
  if (inf.length === 0) return widths;
  const index = new Map(inf.map((e, i) => [e, i]));
  const A = Matrix.eye(inf.length).mul(λ);
  const b = Matrix.zeros(inf.length, 1);
  for (const e of inf) {
    const image = gTau.image(e.forward).first;
    if (image !== undefined)
      A.set(
        index.get(image.edge) as number,
        index.get(e) as number,
        A.get(index.get(image.edge) as number, index.get(e) as number) - 1,
      );
  }
  for (const [, branch] of realBranch)
    for (const letter of gTau.image(branch.forward)) {
      const i = index.get(letter.edge);
      if (i !== undefined) b.set(i, 0, b.get(i, 0) + (widths.get(branch) as number));
    }
  const x = solve(A, b);
  inf.forEach((e, i) => widths.set(e, x.get(i, 0)));
  return widths;
}

/**
 * For each switch, the total width of its real branch ends minus that of its infinitesimal ones. By the switch
 * equation this is 0 for a train-track map with λ > 1 (up to rounding); useful to check the construction.
 */
export function switchEquationDefects(tt: TrainTrack): Map<Vertex, number> {
  const defects = new Map<Vertex, number>();
  if (tt.widths === undefined) return defects;
  for (const s of tt.graph.vertices) {
    let defect = 0;
    for (const e of tt.graph.star(s))
      defect += (tt.kind.get(e.edge) === "real" ? 1 : -1) * (tt.widths.get(e.edge) as number);
    defects.set(s, defect);
  }
  return defects;
}
