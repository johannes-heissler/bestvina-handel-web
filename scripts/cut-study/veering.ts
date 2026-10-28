/**
 * Agol's veering triangulation of the mapping torus of a pseudo-Anosov map, from its Bestvina–Handel train track
 * (prototype for the cut study; see docs/port-notes/30-veering-triangulations.md).
 *
 * The surface is punctured at all singularities and punctures (S°). A trivalent measured train track on S° is the same
 * as an ideal triangulation of S° (one triangle per switch, one edge per branch) with positive edge weights such that
 * in every triangle the weight of one edge (the large one) is the sum of the other two. Splitting a large branch is
 * the flip of its dual edge, with the new weight w(e′) = max(w(a) + w(c), w(b) + w(d)) − w(e) for the sides a, b, c, d of
 * the quadrilateral in cyclic order. A maximal split flips all edges of maximal weight (they are pairwise disjoint).
 * Agol: the sequence of maximal splits becomes periodic up to φ and scaling; one tetrahedron per flip in one period,
 * the first layer glued to the last by φ, gives the veering triangulation of the mapping torus of φ on S°.
 *
 * Triangles are identified by their cusp (the corner between the two small edges): splitting keeps the cusps of the
 * complementary regions, and φ permutes them as it permutes the cusps of τ (computed from g_τ).
 */
import type { OrientedEdge } from "../../src/graph/ribbon-graph";
import type { TrainTrack } from "../../src/fibred/train-track";

// ─── A trivalent ribbon graph with weights (dual: an ideal triangulation of S°) ─────────────────────

/** Half-edges are numbers; `twin` pairs them, `next` is the ccw successor at the switch, `sw` the switch. */
class Trivalent {
  twin: number[] = [];
  next: number[] = [];
  sw: number[] = [];
  weight: number[] = []; // per half-edge (both halves equal)
  /** For original branches of τ: the oriented branch of τ this half-edge starts. */
  origin: (OrientedEdge | undefined)[] = [];
  switchCount = 0;

  newEdge(w: number): [number, number] {
    const h = this.twin.length;
    this.twin.push(h + 1, h);
    this.next.push(-1, -1);
    this.sw.push(-1, -1);
    this.weight.push(w, w);
    this.origin.push(undefined, undefined);
    return [h, h + 1];
  }
  /** Sets the cyclic order (ccw) of a switch. */
  setStar(s: number, star: number[]) {
    star.forEach((h, i) => {
      this.sw[h] = s;
      this.next[h] = star[(i + 1) % star.length] as number;
    });
  }
  star(h: number): number[] {
    const result = [h];
    for (let x = this.next[h] as number; x !== h; x = this.next[x] as number) result.push(x);
    return result;
  }
  /** The large half-edge of the trivalent switch of h: the one of maximal weight. */
  large(h: number): number {
    const st = this.star(h);
    return st.reduce((a, b) => ((this.weight[b] as number) > (this.weight[a] as number) ? b : a));
  }
}

/** One cusp: a corner of a complementary region of τ, as (region index, cusp index around the region). */
export interface CuspLabel {
  readonly region: number;
  readonly index: number;
}
const key = (c: CuspLabel) => `${c.region}:${c.index}`;

export interface TrackData {
  graph: Trivalent;
  /** The cusp label of each switch (by any half-edge at it: label of switch sw[h]). */
  labelOfSwitch: Map<number, string>;
  /** φ on cusp labels. */
  phi: Map<string, string>;
  regions: number;
  regionPunctureKind: ("puncture" | "singularity")[];
}

/**
 * Combs τ into a trivalent track and labels its cusps; computes φ on the cusps from g_τ.
 * Sides of a switch of τ: its real branch ends, and its infinitesimal ones.
 */
export function trivalentTrack(tt: TrainTrack): TrackData {
  const tau = tt.graph;
  const widths = tt.widths;
  if (widths === undefined) throw new Error("No widths (growth 1?)");
  const T = new Trivalent();
  const halfOf = new Map<OrientedEdge, number>();
  for (const e of tau.edges) {
    const w = widths.get(e) as number;
    if (!(w > 0)) throw new Error(`Branch ${e.name} has weight ${w}`);
    const [h, k] = T.newEdge(w);
    halfOf.set(e.forward, h);
    halfOf.set(e.backward, k);
    T.origin[h] = e.forward;
    T.origin[k] = e.backward;
  }
  const real = (x: OrientedEdge) => tt.kind.get(x.edge) === "real";

  for (const s of tau.vertices) {
    let star = tau.star(s).map((x) => halfOf.get(x) as number);
    const isReal = new Map(tau.star(s).map((x) => [halfOf.get(x) as number, real(x)]));
    // Rotate so that one side comes first (the star is reals then infinitesimals, but be safe).
    const sides = () => {
      const k = star.findIndex((h, i) => isReal.get(h) !== isReal.get(star[(i - 1 + star.length) % star.length] as number));
      if (k > 0) star = [...star.slice(k), ...star.slice(0, k)];
      const firstSide = star.filter((h) => isReal.get(h) === isReal.get(star[0] as number));
      return { a: firstSide, b: star.slice(firstSide.length) };
    };
    const { a, b } = sides();
    if (a.length === 0 || b.length === 0) throw new Error(`Switch ${s.name} has an empty side`);
    // Comb: merge the first two half-edges of a side into a new branch towards a new switch.
    while (a.length + b.length > 3) {
      const side = a.length >= 2 ? a : b;
      const [h1, h2] = side as [number, number];
      const [toNew, atNew] = T.newEdge((T.weight[h1] as number) + (T.weight[h2] as number));
      const t = T.switchCount++;
      T.setStar(t, [h1, h2, atNew]);
      isReal.set(toNew, isReal.get(h1) as boolean);
      side.splice(0, 2, toNew);
      star = [...a, ...b];
    }
    if (a.length + b.length === 2) {
      // A valence-2 switch: join its two branches into one.
      const [h1, h2] = [a[0] as number, b[0] as number];
      const [x, y] = [T.twin[h1] as number, T.twin[h2] as number];
      T.twin[x] = y;
      T.twin[y] = x;
      T.twin[h1] = T.twin[h2] = -1;
      continue;
    }
    T.setStar(T.switchCount++, [...a, ...b]);
  }

  // Regions: boundary walks h → next(twin(h)) over live half-edges, in the trivalent graph and in τ.
  const live = (h: number) => T.twin[h] !== -1 && T.sw[h] !== -1;
  const halves = [...T.twin.keys()].filter(live);
  const regionOfHalf = new Map<number, number>();
  // The boundary words of τ, each rotated to start at a letter whose half-edge survives the combing.
  const tauWords = tau.boundaryWords().map((w) => {
    const k = w.letters.findIndex((x) => live(halfOf.get(x) as number));
    if (k < 0) throw new Error("A region of τ has no surviving half-edge");
    return { letters: [...w.letters.slice(k), ...w.letters.slice(0, k)], length: w.length };
  });
  // The region of a word of τ: by its first letter, which is an original half-edge in the trivalent graph too.
  const labelOfSwitch = new Map<number, string>();
  const regionPunctureKind: ("puncture" | "singularity")[] = [];
  const cuspTurnsOfTauWord: number[][] = []; // per region: the turn indices i (between letter i and i+1) that are cusps
  tauWords.forEach((word, r) => {
    const letters = word.letters;
    const turns: number[] = [];
    letters.forEach((x, i) => {
      const y = letters[(i + 1) % letters.length] as OrientedEdge;
      if (real(x.reversed) === real(y)) turns.push(i);
    });
    cuspTurnsOfTauWord.push(turns);
    regionPunctureKind.push(letters.every((x) => !real(x)) ? "singularity" : "puncture");
    // Walk the same region in the trivalent graph from the first letter; label cusp corners in order.
    const start = halfOf.get(letters[0] as OrientedEdge) as number;
    let index = 0;
    let h = start;
    let guard = 0;
    do {
      regionOfHalf.set(h, r);
      const arrive = T.twin[h] as number;
      const nxt = T.next[arrive] as number;
      // The corner (arrive | nxt) at the switch: a cusp iff neither is the large half-edge.
      const L = T.large(arrive);
      if (L !== arrive && L !== nxt) labelOfSwitch.set(T.sw[arrive] as number, key({ region: r, index: index++ }));
      h = nxt;
      if (++guard > 1e6) throw new Error("Boundary walk does not close");
    } while (h !== start);
    if (index !== turns.length) throw new Error(`Region ${r}: ${index} cusps in the trivalent track, ${turns.length} in τ`);
  });
  if (labelOfSwitch.size !== T.switchCount) throw new Error(`${labelOfSwitch.size} cusps for ${T.switchCount} switches`);
  if (regionOfHalf.size !== halves.length) throw new Error("Not every half-edge lies on a region of τ");

  // φ on cusps: reduce g_τ(boundary word) and read off where the cusp turns land.
  const wordKey = (xs: readonly OrientedEdge[]) => xs.map((x) => `${x.edge.name}${x.isForward ? "" : "'"}`);
  const phi = new Map<string, string>();
  tauWords.forEach((word, r) => {
    const letters = word.letters;
    const tagged: { x: OrientedEdge; tag: number }[] = [];
    letters.forEach((x, i) => {
      for (const y of tt.gTau.image(x).letters) {
        const top = tagged[tagged.length - 1];
        if (top !== undefined && top.x === y.reversed) tagged.pop();
        else tagged.push({ x: y, tag: i });
      }
    });
    while (tagged.length > 1 && (tagged[0] as { x: OrientedEdge }).x === (tagged[tagged.length - 1] as { x: OrientedEdge }).x.reversed) {
      tagged.shift();
      tagged.pop();
    }
    const image = tagged.map((t) => t.x);
    // Find the image region and the rotation.
    const imgKey = wordKey(image).join(" ");
    let found: { r2: number; rot: number } | undefined;
    tauWords.forEach((w2, r2) => {
      if (w2.length !== image.length || found) return;
      const k2 = wordKey(w2.letters);
      for (let rot = 0; rot < k2.length; rot++)
        if ([...k2.slice(rot), ...k2.slice(0, rot)].join(" ") === imgKey) {
          found = { r2, rot };
          return;
        }
    });
    if (!found) throw new Error(`The image of region ${r} is no boundary word`);
    const { r2, rot } = found;
    // Turn i of r (between letters i and i+1) lands between image letters p−1 and p, p = first index with tag > i.
    cuspTurnsOfTauWord[r]!.forEach((i, ci) => {
      let p = tagged.findIndex((t) => t.tag > i);
      if (p < 0 || i === letters.length - 1) p = 0;
      // In r2's word (rotated by rot), image index p is letter (p + rot); the turn before it is turn (p + rot − 1).
      const n2 = tauWords[r2]!.length;
      const turn = (((p + rot - 1) % n2) + n2) % n2;
      const j = cuspTurnsOfTauWord[r2]!.indexOf(turn);
      if (j < 0) throw new Error(`Cusp ${ci} of region ${r} does not land on a cusp`);
      phi.set(key({ region: r, index: ci }), key({ region: r2, index: j }));
    });
  });
  if (new Set(phi.values()).size !== phi.size) throw new Error("φ is not injective on cusps");
  return { graph: T, labelOfSwitch, phi, regions: tauWords.length, regionPunctureKind };
}

// ─── Splitting and layering ────────────────────────────────────────────────────────────────────

/** A triangle (switch) as a face of tetrahedra: its three half-edges (ccw) when it was created. */
interface Face {
  halves: [number, number, number];
  label: string;
  /** The tetrahedron below (whose top face this is) and the vertex of it at each corner; undefined for the first layer. */
  below?: { tet: number; vertices: [number, number, number] };
}

export interface Tetrahedron {
  /** neighbours[f] = tetrahedron glued to face f (opposite vertex f); gluing[f] = images of vertices 0..3 */
  neighbours: number[];
  gluings: number[][];
  /** Colour of the bottom diagonal edge (vertices 1-3 here: B–D), "R" or "L". */
  bottomColor: "R" | "L";
}

export interface Veering {
  /**
   * The fibre class as a cocycle on faces: [tetrahedron, face (a bottom face of it), number of periods the gluing
   * wraps around]; every other face has value 0 (it lies inside one period).
   */
  fibre?: [number, number, number][];
  tetrahedra: Tetrahedron[];
  prePeriod: number;
  period: number;
  scale: number;
  direction: "phi" | "phiInverse";
}

/** The canonical neighbourhood of every triangle: by label, the label and slot across each edge, and the weights. */
function snapshot(T: Trivalent, faces: Map<number, Face>) {
  const result = new Map<string, { across: [string, number][]; weights: number[] }>();
  for (const [s, f] of faces) {
    const st = T.star(f.halves[0]);
    // Start at the large half-edge.
    const L = T.large(st[0] as number);
    const rot = T.star(L);
    const across = rot.map((h): [string, number] => {
      const o = T.twin[h] as number;
      const of = faces.get(T.sw[o] as number) as Face;
      const ost = T.star(T.large(o));
      return [of.label, ost.indexOf(o)];
    });
    result.set(f.label, { across, weights: rot.map((h) => T.weight[h] as number) });
    void s;
  }
  return result;
}

/**
 * Runs maximal splits until the triangulation repeats up to φ^{±1} and scaling, then builds the layered tetrahedra of
 * one period. Relative tolerance `tol` for equal weights.
 */
export function agol(data: TrackData, maxLayers = 20000, tol = 1e-9): { n: number; m: number; scale: number; direction: "phi" | "phiInverse" } {
  const T = data.graph;
  const faces = new Map<number, Face>();
  const switchHalves = new Map<number, number>();
  for (let h = 0; h < T.twin.length; h++) if (T.twin[h] !== -1 && T.sw[h] !== -1 && !switchHalves.has(T.sw[h]!)) switchHalves.set(T.sw[h]!, h);
  for (const [s, h] of switchHalves) faces.set(s, { halves: T.star(h) as [number, number, number], label: data.labelOfSwitch.get(s) as string });

  const history: ReturnType<typeof snapshot>[] = [snapshot(T, faces)];
  const inverse = new Map([...data.phi].map(([a, b]) => [b, a]));
  const matches = (a: ReturnType<typeof snapshot>, b: ReturnType<typeof snapshot>, map: Map<string, string>) => {
    let scale: number | undefined;
    for (const [label, na] of a) {
      const nb = b.get(map.get(label) as string);
      if (!nb) return undefined;
      for (let i = 0; i < 3; i++) {
        const [l, slot] = na.across[i] as [string, number];
        const [l2, slot2] = nb.across[i] as [string, number];
        if (map.get(l) !== l2 || slot !== slot2) return undefined;
        const r = (nb.weights[i] as number) / (na.weights[i] as number);
        if (scale === undefined) scale = r;
        else if (Math.abs(r - scale) > tol * 1e3 * scale) return undefined;
      }
    }
    return scale;
  };

  const flips: { e: number }[][] = []; // per layer: the half-edges flipped (one of each pair)
  const maxSplit = (record: boolean, onFlip?: (h: number) => void) => {
    let max = 0;
    for (let h = 0; h < T.twin.length; h++) if (T.sw[h] !== -1 && T.twin[h] !== -1) max = Math.max(max, T.weight[h] as number);
    const toFlip: number[] = [];
    const seen = new Set<number>();
    for (let h = 0; h < T.twin.length; h++) {
      if (T.sw[h] === -1 || T.twin[h] === -1 || seen.has(h)) continue;
      if ((T.weight[h] as number) >= max * (1 - tol)) {
        toFlip.push(h);
        seen.add(h).add(T.twin[h] as number);
      }
    }
    for (const h of toFlip) (onFlip ?? flip)(h);
    if (record) flips.push(toFlip.map((e) => ({ e })));
    // Rescale to keep magnitudes near 1.
    let m2 = 0;
    for (let h = 0; h < T.twin.length; h++) if (T.sw[h] !== -1 && T.twin[h] !== -1) m2 = Math.max(m2, T.weight[h] as number);
    void m2;
  };

  /** Flips the edge of half-edge eu (large at both ends); returns the info needed for a tetrahedron. */
  const flip = (eu: number) => {
    const ev = T.twin[eu] as number;
    const u = T.sw[eu] as number;
    const v = T.sw[ev] as number;
    if (T.large(eu) !== eu || T.large(ev) !== ev) throw new Error("Flipping an edge that is not large at both ends");
    const [, a, b] = T.star(eu) as [number, number, number];
    const [, c, d] = T.star(ev) as [number, number, number];
    const [wa, wb, wc, wd, we] = [a, b, c, d, eu].map((h) => T.weight[h] as number) as [number, number, number, number, number];
    const case1 = wa + wc >= wb + wd;
    const w2 = Math.max(wa + wc, wb + wd) - we;
    const fu = faces.get(u) as Face;
    const fv = faces.get(v) as Face;
    // New triangles: u' = (e', b, c), v' = (e', d, a), reusing the switch numbers and the edge.
    T.weight[eu] = T.weight[ev] = w2;
    T.setStar(u, [eu, b, c]);
    T.setStar(v, [ev, d, a]);
    // Cusps: case 1 → u' has its cusp at A (u's label), v' at C (v's label); case 2 the other way round.
    const nu: Face = { halves: [eu, b, c], label: case1 ? fu.label : fv.label };
    const nv: Face = { halves: [ev, d, a], label: case1 ? fv.label : fu.label };
    faces.set(u, nu);
    faces.set(v, nv);
    return { fu, fv, nu, nv, eu, ev, a, b, c, d, case1 };
  };

  // Phase 1: find the period.
  let found: { n: number; m: number; scale: number; direction: "phi" | "phiInverse" } | undefined;
  for (let j = 1; j <= maxLayers && !found; j++) {
    maxSplit(false);
    const snap = snapshot(T, faces);
    history.push(snap);
    for (let n = j - 1; n >= 0 && !found; n--) {
      for (const [map, direction] of [[data.phi, "phi"], [inverse, "phiInverse"]] as const) {
        const scale = matches(history[n] as typeof snap, snap, map);
        if (scale !== undefined && scale < 1 - 1e-9) {
          found = { n, m: j - n, scale, direction };
          break;
        }
      }
    }
  }
  if (!found) throw new Error("No period found");
  return found;
}

/**
 * Agol's veering triangulation of the mapping torus of φ on S° (all singularities and punctures drilled): finds the
 * period on one copy of the track, then rebuilds the track, skips the pre-period and makes one tetrahedron per flip.
 */
export function veeringTriangulation(build: () => TrackData): Veering & { data: TrackData } {
  const period = agol(build());
  const data = build();
  const T = data.graph;
  const faces = new Map<number, Face>();
  for (let h = 0; h < T.twin.length; h++)
    if (T.twin[h] !== -1 && T.sw[h] !== -1 && !faces.has(T.sw[h]!))
      faces.set(T.sw[h]!, { halves: T.star(h) as [number, number, number], label: data.labelOfSwitch.get(T.sw[h]!) as string });
  const live = () => [...T.twin.keys()].filter((h) => T.twin[h] !== -1 && T.sw[h] !== -1);
  const maximal = (tol = 1e-9) => {
    const hs = live();
    const max = Math.max(...hs.map((h) => T.weight[h] as number));
    const seen = new Set<number>();
    const result: number[] = [];
    for (const h of hs)
      if (!seen.has(h) && (T.weight[h] as number) >= max * (1 - tol)) {
        result.push(h);
        seen.add(h).add(T.twin[h] as number);
      }
    return result;
  };
  const flipOnly = (eu: number) => {
    const ev = T.twin[eu] as number;
    const [u, v] = [T.sw[eu] as number, T.sw[ev] as number];
    const [, a, b] = T.star(eu) as [number, number, number];
    const [, c, d] = T.star(ev) as [number, number, number];
    const [wa, wb, wc, wd, we] = [a, b, c, d, eu].map((h) => T.weight[h] as number) as number[];
    const case1 = wa! + wc! >= wb! + wd!;
    const fu = faces.get(u) as Face;
    const fv = faces.get(v) as Face;
    T.weight[eu] = T.weight[ev] = Math.max(wa! + wc!, wb! + wd!) - we!;
    T.setStar(u, [eu, b, c]);
    T.setStar(v, [ev, d, a]);
    const nu: Face = { halves: [eu, b, c], label: case1 ? fu.label : fv.label };
    const nv: Face = { halves: [ev, d, a], label: case1 ? fv.label : fu.label };
    faces.set(u, nu);
    faces.set(v, nv);
    return { fu, fv, nu, nv, eu, ev, a, b, c, d, case1 };
  };
  for (let j = 0; j < period.n; j++) for (const h of maximal()) flipOnly(h);
  for (const f of faces.values()) (f as Face & { cusp?: number }).cusp = [0, 1, 2].find((i) => { const L = T.large(f.halves[0]); return f.halves[i] !== L && f.halves[(i + 1) % 3] !== L; });
  const bottomFaces = new Map([...faces.values()].map((f) => [f.label, f]));

  // Vertices of each tetrahedron: A = 0, B = 1, C = 2, D = 3; bottom diagonal BD, top diagonal AC.
  const [A, B, C, D] = [0, 1, 2, 3];
  const tets: Tetrahedron[] = [];
  /** Where each face of the first layer sits as the bottom face of a tetrahedron. */
  const above = new Map<string, { tet: number; vertices: [number, number, number] }>();
  const corners = (f: Face, first: number, verts: [number, number, number]): [number, number, number] => {
    const k = f.halves.indexOf(first);
    if (k < 0) throw new Error("Half-edge not on the face");
    const out: number[] = [];
    for (let i = 0; i < 3; i++) out[(k + i) % 3] = verts[i] as number;
    return out as [number, number, number];
  };
  const glue = (x: { tet: number; vertices: number[] }, y: { tet: number; vertices: number[] }) => {
    const fx = [0, 1, 2, 3].find((i) => !x.vertices.includes(i)) as number;
    const fy = [0, 1, 2, 3].find((i) => !y.vertices.includes(i)) as number;
    const perm = [0, 0, 0, 0];
    x.vertices.forEach((vx, i) => (perm[vx] = y.vertices[i] as number));
    perm[fx] = fy;
    const inv = [0, 0, 0, 0];
    perm.forEach((v, i) => (inv[v] = i));
    const tx = tets[x.tet] as Tetrahedron;
    const ty = tets[y.tet] as Tetrahedron;
    if (tx.neighbours[fx] !== -1 || ty.neighbours[fy] !== -1) throw new Error("Face glued twice");
    tx.neighbours[fx] = y.tet;
    tx.gluings[fx] = perm;
    ty.neighbours[fy] = x.tet;
    ty.gluings[fy] = inv;
  };
  for (let j = 0; j < period.m; j++)
    for (const h of maximal()) {
      const t = tets.length;
      const r = flipOnly(h);
      tets.push({ neighbours: [-1, -1, -1, -1], gluings: [[], [], [], []], bottomColor: r.case1 ? "R" : "L" });
      // Old u = ABD: corners (e|a) = D, (a|b) = A, (b|e) = B; old v = BCD: (e|c) = B, (c|d) = C, (d|e) = D.
      const bu = { tet: t, vertices: corners(r.fu, r.eu, [D, A, B]) };
      const bv = { tet: t, vertices: corners(r.fv, r.ev, [B, C, D]) };
      for (const [f, slot] of [[r.fu, bu], [r.fv, bv]] as const) {
        if (f.below) glue(f.below, slot);
        else above.set(f.label, slot);
      }
      // New u' = ABC: (e'|b) = A, (b|c) = B, (c|e') = C; new v' = ACD: (e'|d) = C, (d|a) = D, (a|e') = A.
      r.nu.below = { tet: t, vertices: [A, B, C] };
      r.nv.below = { tet: t, vertices: [C, D, A] };
    }
  // Close up: the top face labelled map(c) is glued to the bottom face labelled c, cusp corner to cusp corner.
  const map = period.direction === "phi" ? data.phi : new Map([...data.phi].map(([a2, b2]) => [b2, a2]));
  const cuspCorner = (f: Face) => [0, 1, 2].find((i) => {
    const L = T.large(f.halves[0]);
    return f.halves[i] !== L && f.halves[(i + 1) % 3] !== L;
  }) as number;
  void bottomFaces;
  const bottomCusp = new Map<string, number>();
  // The cusp corner of a first-layer face, computed before it was flipped: recompute from its stored large side.
  for (const [label, f] of bottomFaces) bottomCusp.set(label, (f as Face & { cusp?: number }).cusp ?? -1);
  // A face born in the period and alive at its end is (T_{n+m}, ℓ) ≅ (T_n, map⁻¹(ℓ)); it dies where that face dies, or,
  // if that face survives the whole period too, one period later, and so on (every face dies eventually).
  const mapInv = new Map([...map].map(([x2, y2]) => [y2, x2]));
  const cuspOrdered = (verts: readonly number[], cusp: number) => [0, 1, 2].map((k) => verts[(cusp + k) % 3] as number);
  const fibre: [number, number, number][] = [];
  for (const top of faces.values()) {
    if (!top.below) continue;
    let c = mapInv.get(top.label) as string;
    let wraps = 1;
    for (let guard = 0; !above.has(c); guard++, wraps++) {
      if (guard > 1e6) throw new Error("A face never dies");
      c = mapInv.get(c) as string;
    }
    const slot = above.get(c) as { tet: number; vertices: [number, number, number] };
    glue(
      { tet: top.below.tet, vertices: cuspOrdered(top.below.vertices, cuspCorner(top)) },
      { tet: slot.tet, vertices: cuspOrdered(slot.vertices, bottomCusp.get(c) as number) },
    );
    fibre.push([slot.tet, [0, 1, 2, 3].find((i) => !slot.vertices.includes(i)) as number, wraps]);
  }
  return { ...period, tetrahedra: tets, data, fibre };
}