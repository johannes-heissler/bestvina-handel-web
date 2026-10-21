// Prints the stripped characteristic polynomial of every node of a chain folder: `node chain-polys.mjs <dir>`.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { charpoly, strip, show, isReciprocal, evalAt } from "./poly.mjs";
const dir = process.argv[2];
const lines = readFileSync(path.join(dir, "chain.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
for (const l of lines) {
  const f = path.join(dir, `node-${l.k}.matrix.json`);
  if (!existsSync(f)) continue;
  const { M } = JSON.parse(readFileSync(f, "utf8"));
  const t = performance.now();
  const { x, cyclo, rest } = strip(charpoly(M));
  console.log(JSON.stringify({ k: l.k, P: l.punctures, λ: +l.growth.toFixed(10), n: M.length, x, cyclo, deg: rest.length - 1, rec: isReciprocal(rest), check: +evalAt(rest, l.growth).toExponential(1), rest: show(rest), ms: Math.round(performance.now() - t) }));
}
