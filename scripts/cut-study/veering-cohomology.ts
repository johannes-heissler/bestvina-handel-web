/**
 * Cohomology of a layered (taut) triangulation, its fibred cone, and isomorphisms between two of them.
 *
 * Conventions of veering.ts: vertices A, B, C, D = 0, 1, 2, 3; faces 0 (BCD) and 2 (ABD) are bottom faces, 1 (ACD) and
 * 3 (ABC) top faces. A face is a dual edge from the tetrahedron below to the one above. H¹ is computed as cocycles on
 * the faces modulo coboundaries of functions on the tetrahedra, over ℚ.
 */
import type { Tetrahedron } from "./veering";

// ─── Exact rationals ─────────────────────────────────────────────────────────────────────────

export class Q {
  constructor(readonly n: bigint, readonly d: bigint = 1n) {
    if (d === 0n) throw new Error("division by zero");
  }
  static of(n: number | bigint, d: number | bigint = 1) {
    return Q.norm(BigInt(n), BigInt(d));
  }
  static norm(n: bigint, d: bigint) {
    if (d < 0n) [n, d] = [-n, -d];
    const g = gcd(n < 0n ? -n : n, d);
    return new Q(n / (g || 1n), d / (g || 1n));
  }
  add(o: Q) {
    return Q.norm(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Q) {
    return Q.norm(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Q) {
    return Q.norm(this.n * o.n, this.d * o.d);
  }
  div(o: Q) {
    return Q.norm(this.n * o.d, this.d * o.n);
  }
  isZero() {
    return this.n === 0n;
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  }
  toString() {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }
}
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}
const ZERO = Q.of(0);

/** Row-reduced basis of the row space (rows of rationals); returns rows with their pivot columns. */
function rowBasis(rows: Q[][]): { row: Q[]; pivot: number }[] {
  const basis: { row: Q[]; pivot: number }[] = [];
  for (const r0 of rows) {
    let r = r0;
    for (const { row, pivot } of basis)
      if (!r[pivot]!.isZero()) {
        const f = r[pivot]!.div(row[pivot]!);
        r = r.map((x, i) => x.sub(f.mul(row[i]!)));
      }
    const pivot = r.findIndex((x) => !x.isZero());
    if (pivot >= 0) basis.push({ row: r, pivot });
  }
  return basis;
}
function reduce(v: Q[], basis: { row: Q[]; pivot: number }[]): Q[] {
  let r = v;
  for (const { row, pivot } of basis)
    if (!r[pivot]!.isZero()) {
      const f = r[pivot]!.div(row[pivot]!);
      r = r.map((x, i) => x.sub(f.mul(row[i]!)));
    }
  return r;
}
/** A basis of the null space {x : A x = 0} (A given by rows). */
function nullSpace(A: Q[][], n: number): Q[][] {
  // Reduced row echelon form.
  const rows = A.map((r) => [...r]);
  const pivots: number[] = [];
  let rank = 0;
  for (let col = 0; col < n && rank < rows.length; col++) {
    const p = rows.findIndex((r, i) => i >= rank && !r[col]!.isZero());
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p]!, rows[rank]!];
    const piv = rows[rank]![col]!;
    rows[rank] = rows[rank]!.map((x) => x.div(piv));
    for (let i = 0; i < rows.length; i++)
      if (i !== rank && !rows[i]![col]!.isZero()) {
        const f = rows[i]![col]!;
        rows[i] = rows[i]!.map((x, j) => x.sub(f.mul(rows[rank]![j]!)));
      }
    pivots.push(col);
    rank++;
  }
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const x = Array(n).fill(ZERO) as Q[];
    x[f] = Q.of(1);
    pivots.forEach((pc, i) => (x[pc] = rows[i]![f]!.mul(Q.of(-1))));
    return x;
  });
}

// ─── The cell structure ──────────────────────────────────────────────────────────────────────

const BOTTOM = new Set([0, 2]);

export interface Layered {
  tets: Tetrahedron[];
  /** Faces: each glued pair once, as the bottom face [tet above, face] and the top face [tet below, face]. */
  faces: { above: [number, number]; below: [number, number] }[];
  faceIndex: Map<string, number>;
}

export function layered(tets: Tetrahedron[]): Layered {
  const faces: Layered["faces"] = [];
  const faceIndex = new Map<string, number>();
  tets.forEach((tet, t) =>
    [0, 2].forEach((f) => {
      const u = tet.neighbours[f] as number;
      const fu = (tet.gluings[f] as number[])[f] as number;
      if (BOTTOM.has(fu)) throw new Error("A bottom face glued to a bottom face: not layered");
      faceIndex.set(`${t}:${f}`, faces.length);
      faceIndex.set(`${u}:${fu}`, faces.length);
      faces.push({ above: [t, f], below: [u, fu] });
    }),
  );
  return { tets, faces, faceIndex };
}

/** The loops around the edges: for each edge class, the signed faces crossed (+1 upward). */
function edgeLoops(L: Layered): Map<number, number>[] {
  const seen = new Set<string>();
  const loops: Map<number, number>[] = [];
  const EDGES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] as const;
  L.tets.forEach((_, t0) =>
    EDGES.forEach(([a0, b0]) => {
      const k = `${t0}:${Math.min(a0, b0)}${Math.max(a0, b0)}`;
      if (seen.has(k)) return;
      const [c0, d0] = [0, 1, 2, 3].filter((x) => x !== a0 && x !== b0) as [number, number];
      const loop = new Map<number, number>();
      let [t, a, b, c, d] = [t0, a0, b0, c0, d0];
      for (let guard = 0; guard < 10000; guard++) {
        seen.add(`${t}:${Math.min(a, b)}${Math.max(a, b)}`);
        // Exit through the face opposite d.
        const face = L.faceIndex.get(`${t}:${d}`) as number;
        const up = !BOTTOM.has(d); // leaving through a top face goes upward
        loop.set(face, (loop.get(face) ?? 0) + (up ? 1 : -1));
        const u = L.tets[t]!.neighbours[d] as number;
        const p = L.tets[t]!.gluings[d] as number[];
        [t, a, b, c, d] = [u, p[a]!, p[b]!, p[d]!, p[c]!];
        if (t === t0 && a === a0 && b === b0 && c === c0) break;
      }
      loops.push(loop);
    }),
  );
  return loops;
}

export interface Cohomology {
  L: Layered;
  /** Basis of H¹ ⊗ ℚ as cocycles (values per face), and the coboundaries' row basis. */
  basis: Q[][];
  coboundaries: { row: Q[]; pivot: number }[];
  cocycleRows: Q[][];
}

export function cohomology(tets: Tetrahedron[], first?: Q[]): Cohomology {
  const L = layered(tets);
  const nf = L.faces.length;
  // Cocycle condition: the sum around every edge loop is 0.
  const cocycleRows = edgeLoops(L).map((loop) => {
    const r = Array(nf).fill(ZERO) as Q[];
    for (const [f, s] of loop) r[f] = Q.of(s);
    return r;
  });
  const Z1 = nullSpace(cocycleRows, nf);
  // Coboundaries: δ(tet) = +1 on faces where it is the tet above, −1 where below.
  const B1 = L.tets.map((_, t) => L.faces.map((f) => Q.of((f.above[0] === t ? 1 : 0) - (f.below[0] === t ? 1 : 0))));
  const coboundaries = rowBasis(B1);
  const basis: Q[][] = [];
  const span = [...coboundaries];
  for (const z of first ? [first, ...Z1] : Z1) {
    const r = reduce(z, span);
    if (r.some((x) => !x.isZero())) {
      basis.push(z);
      span.push(...rowBasis([r]));
    }
  }
  return { L, basis, coboundaries, cocycleRows };
}

/** The fibre cocycle from veering.ts's `fibre` list. */
export function fibreCocycle(L: Layered, fibre: [number, number, number][]): Q[] {
  const c = Array(L.faces.length).fill(ZERO) as Q[];
  for (const [t, f, wraps] of fibre) c[L.faceIndex.get(`${t}:${f}`) as number] = Q.of(wraps);
  return c;
}

/** Coordinates of a cocycle in the basis (modulo coboundaries), via evaluation on cycles. */
export function coordinates(H: Cohomology, cocycle: Q[], cycles: number[][]): Q[] {
  // Solve Σ x_i basis_i(z) = cocycle(z) for the given cycles (as signed face lists).
  const evalOn = (c: Q[], z: number[]) => z.reduce((s, f) => s.add(f >= 0 ? c[f]! : c[-f - 1]!.mul(Q.of(-1))), ZERO);
  const k = H.basis.length;
  const A = cycles.map((z) => H.basis.map((b) => evalOn(b, z)));
  const y = cycles.map((z) => evalOn(cocycle, z));
  // Least-squares-free: pick k independent rows.
  const rows = A.map((r, i) => [...r, y[i]!]);
  const B = rowBasis(rows.map((r) => r));
  // Back-substitute from a full system: use rows in echelon form.
  const sol = Array(k).fill(ZERO) as Q[];
  for (let i = B.length - 1; i >= 0; i--) {
    const { row, pivot } = B[i]!;
    if (pivot >= k) throw new Error("Inconsistent: the cocycle is not in the span");
    let s = row[k]!;
    for (let j = pivot + 1; j < k; j++) s = s.sub(row[j]!.mul(sol[j]!));
    sol[pivot] = s.div(row[pivot]!);
  }
  return sol;
}

// ─── Directed cycles of the dual graph (closed transversals): the fibred cone ────────────────

/** Simple directed cycles of the upward dual graph, as lists of faces (indices); at most `limit`. */
export function directedCycles(L: Layered, limit = 20000): number[][] {
  const n = L.tets.length;
  const out: [number, number][][] = L.tets.map(() => []); // tet → [face, tet above]
  L.faces.forEach((f, i) => out[f.below[0]]!.push([i, f.above[0]]));
  const cycles: number[][] = [];
  // Johnson-style enumeration restricted to cycles whose smallest vertex is the start.
  for (let s = 0; s < n && cycles.length < limit; s++) {
    const path: number[] = [];
    const onPath = new Set<number>([s]);
    const dfs = (v: number) => {
      if (cycles.length >= limit) return;
      for (const [face, w] of out[v]!) {
        if (w === s) cycles.push([...path, face]);
        else if (w > s && !onPath.has(w)) {
          onPath.add(w);
          path.push(face);
          dfs(w);
          path.pop();
          onPath.delete(w);
        }
      }
    };
    dfs(s);
  }
  return cycles;
}

// ─── Isomorphisms ────────────────────────────────────────────────────────────────────────────

/** All combinatorial isomorphisms a → b mapping tetrahedron 0 somewhere, as (tet map, vertex perms), keeping the coorientation. */
export function isomorphisms(a: Tetrahedron[], b: Tetrahedron[]): { tet: number[]; perm: number[][] }[] {
  if (a.length !== b.length) return [];
  const perms: number[][] = [];
  const permute = (xs: number[], acc: number[]) => {
    if (xs.length === 0) perms.push(acc);
    xs.forEach((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)], [...acc, x]));
  };
  permute([0, 1, 2, 3], []);
  // Keep the taut structure: bottom faces {0, 2} to bottom faces.
  const taut = perms.filter((p) => BOTTOM.has(p[0]!) && BOTTOM.has(p[2]!));
  const result: { tet: number[]; perm: number[][] }[] = [];
  for (let t = 0; t < b.length; t++)
    for (const p0 of taut) {
      const tet = Array(a.length).fill(-1) as number[];
      const perm: number[][] = Array(a.length).fill(null);
      tet[0] = t;
      perm[0] = p0;
      const queue = [0];
      let ok = true;
      while (queue.length && ok) {
        const x = queue.shift() as number;
        for (let f = 0; f < 4 && ok; f++) {
          const y = a[x]!.neighbours[f] as number;
          const g = a[x]!.gluings[f] as number[];
          const px = perm[x]!;
          const bx = tet[x]!;
          const bf = px[f]!;
          const by = b[bx]!.neighbours[bf] as number;
          const bg = b[bx]!.gluings[bf] as number[];
          // perm[y] ∘ g = bg ∘ perm[x]  ⇒  perm[y](g(v)) = bg(px(v))
          const py = [0, 0, 0, 0];
          for (let v = 0; v < 4; v++) py[g[v]!] = bg[px[v]!]!;
          if (tet[y] === -1) {
            tet[y] = by;
            perm[y] = py;
            queue.push(y);
          } else if (tet[y] !== by || perm[y]!.some((v, i) => v !== py[i])) ok = false;
        }
      }
      if (ok && new Set(tet).size === a.length) result.push({ tet, perm });
    }
  return result;
}

/** Pulls a cocycle on b back along an isomorphism a → b (faces map to faces, upward to upward). */
export function pullBack(La: Layered, Lb: Layered, iso: { tet: number[]; perm: number[][] }, cocycle: Q[]): Q[] {
  return La.faces.map((f) => {
    const [t, face] = f.above;
    return cocycle[Lb.faceIndex.get(`${iso.tet[t]}:${iso.perm[t]![face]}`) as number]!;
  });
}
