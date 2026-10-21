/** All simple directed cycles of the upward dual graph of the model: their classes (e1, e2 values), and the cone. */
import { readFileSync } from "node:fs";
import { trainTrack } from "../../src/fibred/train-track";
import { deserialize } from "./study";
import { trivalentTrack, veeringTriangulation } from "./veering";
import { cohomology, fibreCocycle, layered, Q } from "./veering-cohomology";

const fs = deserialize(JSON.parse(readFileSync(process.argv[2] as string, "utf8")));
const v = veeringTriangulation(() => trivalentTrack(trainTrack(fs)));
const L = layered(v.tetrahedra);
const H = cohomology(v.tetrahedra, fibreCocycle(L, v.fibre!));
const [c1, c2] = H.basis.map((b) => b.map((x) => x.toNumber())) as [number[], number[]];
const n = L.tets.length;
const out: [number, number][][] = L.tets.map(() => []);
L.faces.forEach((f, i) => out[f.below[0]]!.push([i, f.above[0]]));
const classes = new Map<string, number>();
let count = 0;
for (let s = 0; s < n; s++) {
  const onPath = new Set<number>([s]);
  const dfs = (v0: number, x: number, y: number, len: number) => {
    for (const [face, w] of out[v0]!) {
      const [x2, y2] = [x + c1[face]!, y + c2[face]!];
      if (w === s) {
        count++;
        const k = `${x2},${y2}`;
        classes.set(k, (classes.get(k) ?? 0) + 1);
      } else if (w > s && !onPath.has(w)) {
        onPath.add(w);
        dfs(w, x2, y2, len + 1);
        onPath.delete(w);
      }
    }
  };
  dfs(s, 0, 0, 0);
}
const pts = [...classes.keys()].map((k) => k.split(",").map(Number) as [number, number]);
const ratio = pts.map(([x, y]) => y / x);
console.log("simple directed cycles:", count, " distinct classes:", pts.length);
console.log("min y/x =", Math.min(...ratio), " max y/x =", Math.max(...ratio), " min y =", Math.min(...pts.map((p) => p[1])), " min x =", Math.min(...pts.map((p) => p[0])));
console.log("classes with y = 0:", pts.filter((p) => p[1] === 0).map((p) => p.join(",")).join(" "));
const maxR = Math.max(...ratio);
console.log("classes with maximal y/x:", pts.filter(([x, y]) => y / x === maxR).map((p) => p.join(",")).join(" "));
console.log("cone {(a,b): a·x + b·y > 0 for all}:  a > 0 and b > −a·min(x/y over y>0) =", Math.min(...pts.filter((p) => p[1] > 0).map(([x, y]) => x / y)));
void Q;
