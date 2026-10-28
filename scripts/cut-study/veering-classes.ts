/** Fibre classes of the stages of a cut chain in one model's H¹: `node veering-classes.mjs <model.surface.json> <surface.json>...` */
import { readFileSync } from "node:fs";
import { trainTrack } from "../../src/fibred/train-track";
import { deserialize } from "./study";
import { trivalentTrack, veeringTriangulation } from "./veering";
import { cohomology, coordinates, directedCycles, fibreCocycle, isomorphisms, layered, pullBack, Q } from "./veering-cohomology";

const build = (file: string) => {
  const fs = deserialize(JSON.parse(readFileSync(file, "utf8")));
  const tt = trainTrack(fs);
  const v = veeringTriangulation(() => trivalentTrack(tt));
  const punctures = tt.boundaryWords().filter((b) => !b.infinitesimal).length;
  return { v, λ: tt.growth, punctures, name: file.split(/[/]/).slice(-2).join("/") };
};
const [modelFile, ...files] = process.argv.slice(2) as [string, ...string[]];
const model = build(modelFile);
const Lm = layered(model.v.tetrahedra);
const fm = fibreCocycle(Lm, model.v.fibre!);
const H = cohomology(model.v.tetrahedra, fm);
console.log("model", model.name, "b1 =", H.basis.length, "faces", Lm.faces.length);
const cycles = directedCycles(Lm, 5000);
const evalOn = (c: Q[], z: number[]) => z.reduce((s, f) => s.add(c[f]!), Q.of(0));
const cycleClasses = cycles.map((z) => H.basis.map((b) => evalOn(b, z)));
// The cone {(a, b) : a·x + b·y > 0 for all cycle classes (x, y)}: its boundary rays are perpendicular to extreme (x, y).
const angles = cycleClasses.map(([x, y]) => Math.atan2(y!.toNumber(), x!.toNumber()));
console.log("directed cycles:", cycles.length, " cycle classes (x, y) span angles", Math.min(...angles).toFixed(4), "…", Math.max(...angles).toFixed(4));
const extreme = [cycleClasses[angles.indexOf(Math.min(...angles))]!, cycleClasses[angles.indexOf(Math.max(...angles))]!];
console.log("extreme cycle classes:", extreme.map((v) => v.map(String).join(",")).join("  and  "));
const sample = cycles.slice(0, 400);
for (const f of [modelFile, ...files]) {
  const st = f === modelFile ? model : build(f);
  const Lk = layered(st.v.tetrahedra);
  const isos = isomorphisms(model.v.tetrahedra, st.v.tetrahedra);
  const fk = fibreCocycle(Lk, st.v.fibre!);
  const coords = isos.map((iso) => coordinates(H, pullBack(Lm, Lk, iso, fk), sample).map(String).join(", "));
  // Positivity on the cone: minimum of the class over the cycles.
  console.log(`${st.name.padEnd(28)} P=${String(st.punctures).padStart(3)} λ=${st.λ.toFixed(9)} isos ${isos.length}: (a, b) = ${[...new Set(coords)].join("  |  ")}`);
}
