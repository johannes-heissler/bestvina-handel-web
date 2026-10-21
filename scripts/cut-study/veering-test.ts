/**
 * Agol's veering triangulation for chain nodes: `node veering-test.mjs <out dir> <surface.json>...`.
 * Checks the triangulation (faces, edge classes, tautness, veering) and writes a SnapPea file per node.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { trainTrack } from "../../src/fibred/train-track";
import { deserialize } from "./study";
import { type Tetrahedron, trivalentTrack, veeringTriangulation } from "./veering";

const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

function unionFind(n: number) {
  const parent = [...Array(n).keys()];
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x] as number)));
  return { find, union: (a: number, b: number) => void (parent[find(a)] = find(b)) };
}

export function analyse(tets: Tetrahedron[]) {
  const n = tets.length;
  for (const [t, tet] of tets.entries())
    for (let f = 0; f < 4; f++) if (tet.neighbours[f] === -1) throw new Error(`Face ${f} of tetrahedron ${t} is not glued`);
  // Vertex classes (cusps) and edge classes.
  const V = unionFind(4 * n);
  const E = unionFind(6 * n);
  const edgeIndex = (a: number, b: number) => EDGES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  tets.forEach((tet, t) => {
    for (let f = 0; f < 4; f++) {
      const u = tet.neighbours[f] as number;
      const p = tet.gluings[f] as number[];
      for (let v = 0; v < 4; v++) if (v !== f) V.union(4 * t + v, 4 * u + (p[v] as number));
      for (const [a, b] of EDGES) if (a !== f && b !== f) E.union(6 * t + edgeIndex(a, b), 6 * u + edgeIndex(p[a] as number, p[b] as number));
    }
  });
  const cuspOf = new Map<number, number>();
  for (let i = 0; i < 4 * n; i++) if (!cuspOf.has(V.find(i))) cuspOf.set(V.find(i), cuspOf.size);
  const classes = new Map<number, { bottom: number; top: number; size: number; color?: string }>();
  tets.forEach((tet, t) =>
    EDGES.forEach(([a, b], k) => {
      const c = E.find(6 * t + k);
      const entry = classes.get(c) ?? { bottom: 0, top: 0, size: 0 };
      entry.size++;
      if (a === 1 && b === 3) {
        entry.bottom++;
        entry.color = tet.bottomColor;
      }
      if (a === 0 && b === 2) entry.top++;
      classes.set(c, entry);
    }),
  );
  const taut = [...classes.values()].every((c) => c.bottom === 1 && c.top === 1);
  // Veering: the equatorial edges AB, BC, CD, DA alternate in colour, in the same phase in every tetrahedron.
  const color = (t: number, a: number, b: number) => classes.get(E.find(6 * t + edgeIndex(a, b)))?.color;
  const patterns = new Map<string, number>();
  tets.forEach((_, t) => {
    const p = [color(t, 0, 1), color(t, 1, 2), color(t, 2, 3), color(t, 3, 0)].join("");
    patterns.set(p, (patterns.get(p) ?? 0) + 1);
  });
  // The veering condition as a colouring problem: in every tetrahedron AB = CD = one colour, BC = DA = the other, in
  // the same phase for all (A is an end of the top diagonal; A, B, C, D are anticlockwise seen from above).
  const veering = ["R", "L"].map((first) => {
    const required = new Map<number, string>();
    let ok = true;
    tets.forEach((_, t) =>
      ([[0, 1, first], [2, 3, first], [1, 2, first === "R" ? "L" : "R"], [3, 0, first === "R" ? "L" : "R"]] as const).forEach(([x, y, col]) => {
        const cls = E.find(6 * t + edgeIndex(x, y));
        if (required.has(cls) && required.get(cls) !== col) ok = false;
        required.set(cls, col);
      }),
    );
    return ok;
  });
  const degrees = [...classes.values()].map((c) => c.size).sort((a, b) => a - b);
  return { tetrahedra: n, edges: classes.size, cusps: cuspOf.size, taut, veering, patterns: Object.fromEntries(patterns), degrees, cuspOf: (t: number, v: number) => cuspOf.get(V.find(4 * t + v)) as number };
}

export function snapPea(name: string, tets: Tetrahedron[], cuspOf: (t: number, v: number) => number, cusps: number): string {
  const lines = ["% Triangulation", name, "not_attempted 0.0", "oriented_manifold", "CS_unknown", "", `${cusps} 0`];
  for (let c = 0; c < cusps; c++) lines.push("    torus   0.000000000000   0.000000000000");
  lines.push("", String(tets.length));
  tets.forEach((tet, t) => {
    lines.push("   " + tet.neighbours.map((x) => String(x).padStart(4)).join(" "));
    lines.push(" " + tet.gluings.map((p) => p.join("")).join(" "));
    lines.push("   " + [0, 1, 2, 3].map((v) => String(cuspOf(t, v)).padStart(4)).join(" "));
    for (let k = 0; k < 4; k++) lines.push(" " + Array(16).fill(" 0").join(" "));
    lines.push("  0.000000000000   0.000000000000", "");
  });
  return lines.join("\n");
}

const [outDir, ...files] = process.argv.slice(2) as [string, ...string[]];
for (const file of files) {
  const surface = deserialize(JSON.parse(readFileSync(file, "utf8")));
  const tt = trainTrack(surface);
  const t0 = performance.now();
  const v = veeringTriangulation(() => trivalentTrack(tt));
  const a = analyse(v.tetrahedra);
  const name = path.basename(file).replace(".surface.json", "");
  console.log(
    JSON.stringify({
      node: name,
      λ: +tt.growth.toFixed(9),
      prePeriod: v.n,
      layers: v.m,
      tetrahedra: a.tetrahedra,
      edges: a.edges,
      cusps: a.cusps,
      taut: a.taut,
      veering: a.veering,
      maxDegree: a.degrees.at(-1),
      secs: +((performance.now() - t0) / 1000).toFixed(1),
    }),
  );
  writeFileSync(path.join(outDir, `${name}.tri`), snapPea(name, v.tetrahedra, a.cuspOf, a.cusps));
}
