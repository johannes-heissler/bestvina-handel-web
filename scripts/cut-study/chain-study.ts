/**
 * The endless cut chain, studied node by node.
 *
 * `node chain-study.mjs chain <preset> <firstOrbit> <mode: shortcut|cut> <maxMoves> <outDir>`
 *   follows the chain (the first move takes the orbit with index `firstOrbit` in period order, later moves the first
 *   orbit) and writes per node: a JSON line with the structure, the surface, and the transition matrix.
 * `node chain-study.mjs ref <outDir>`
 *   the closed class D_d⁻¹ D_c₁⁻¹ D_a⁻¹ on the once-punctured surface: classification, reduction, homology action.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyMove } from "../../src/fibred/move";
import { trainTrack } from "../../src/fibred/train-track";
import { perronFrobenius } from "../../src/fibred/perron-frobenius";
import { nextSuggestion, autopilot, plainText } from "../../src/fibred/suggestions";
import type { FibredSurface } from "../../src/fibred/fibred-surface";
import type { Vertex } from "../../src/graph/ribbon-graph";
import { AUTOMATIC, applyChoice, buildExample, genus2PointPushTwists, nodeInfo, runAutopilot, serialize } from "./study";

const [mode, ...args] = process.argv.slice(2) as [string, ...string[]];

/** The transition matrix of g on the strips (rows: crossed strip, columns: strip), as integers. */
function transitionMatrix(fs: FibredSurface): { names: string[]; M: number[][] } {
  const edges = fs.graph.edges;
  const index = new Map(edges.map((e, i) => [e, i]));
  const M = edges.map(() => edges.map(() => 0));
  edges.forEach((e, j) => {
    for (const x of fs.g.image(e.forward).letters) (M[index.get(x.edge) as number] as number[])[j]++;
  });
  return { names: edges.map((e) => e.name), M };
}

/** How g permutes the punctures (the non-infinitesimal boundary words of τ): cycle lengths. */
function punctureCycles(fs: FibredSurface): number[] {
  const tt = trainTrack(fs);
  const words = tt.boundaryWords().filter((b) => !b.infinitesimal).map((b) => b.word);
  // A puncture's boundary word maps to (a cyclic conjugate of) the next one's; identify by the set of real branches.
  const key = (letters: readonly { edge: unknown }[]) => [...new Set(letters.map((x) => x.edge))];
  const sets = words.map((w) => new Set(key(w.letters)));
  const image = words.map((w) => {
    const img = tt.gTau.imageOfPath(w).letters.filter((x) => tt.kind.get(x.edge) === "real");
    const s = new Set(img.map((x) => x.edge));
    return sets.findIndex((t) => [...t].every((e) => s.has(e)));
  });
  const seen = new Set<number>();
  const cycles: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (seen.has(i)) continue;
    let n = 0;
    for (let j = i; j >= 0 && !seen.has(j); j = image[j] as number) {
      seen.add(j);
      n++;
    }
    cycles.push(n);
  }
  return cycles.sort((a, b) => a - b);
}

function record(fs: FibredSurface, k: number, outDir: string, extra: object) {
  const info = nodeInfo(fs);
  const valences: Record<number, number> = {};
  for (const v of fs.graph.vertices) valences[fs.graph.valence(v)] = (valences[fs.graph.valence(v)] ?? 0) + 1;
  const { names, M } = transitionMatrix(fs);
  writeFileSync(path.join(outDir, `node-${k}.surface.json`), JSON.stringify(serialize(fs)));
  writeFileSync(path.join(outDir, `node-${k}.matrix.json`), JSON.stringify({ names, M }));
  let cycles: number[] | string;
  try {
    cycles = punctureCycles(fs);
  } catch (e) {
    cycles = String(e).slice(0, 80);
  }
  const line = {
    k,
    punctures: info.punctures,
    growth: info.growth,
    strips: info.size.strips,
    junctions: info.size.junctions,
    valences,
    punctureCusps: info.shape.punctureCusps,
    singularityProngs: info.shape.singularityProngs,
    orbits: info.orbits.map((o) => ({ junction: o.junction, period: o.period, prongs: o.prongsPerSingularity })),
    punctureCycles: cycles,
    imageLength: info.size.imageLength,
    ...extra,
  };
  appendFileSync(path.join(outDir, "chain.jsonl"), JSON.stringify(line) + "\n");
  console.log(JSON.stringify({ k, P: line.punctures, λ: line.growth, strips: line.strips, orbits: line.orbits.map((o) => o.period), cycles }));
}

if (mode === "chain") {
  const [preset, firstOrbit, how, maxMoves, outDir] = args as [string, string, string, string, string];
  mkdirSync(outDir, { recursive: true });
  let run = runAutopilot(buildExample({ id: preset, family: "preset", genus: 2, preset }));
  if (run.stoppedAt.kind !== "closed surface") run = runAutopilot(applyMove(run.surface, { kind: "mark as closed" }));
  let fs = run.surface;
  for (let k = 0; k <= Number(maxMoves) && run.stoppedAt.kind === "closed surface"; k++) {
    const info = nodeInfo(fs);
    const choices = firstOrbit.split(",").map(Number);
    const orbit = info.orbits[choices[k] ?? 0] ?? info.orbits[0];
    const t = performance.now();
    record(fs, k, outDir, { chosen: orbit?.junction });
    if (k === Number(maxMoves)) break;
    const junction = (orbit as { junction: string }).junction;
    const before = fs;
    try {
      run = runAutopilot(applyChoice(before.copy(), { kind: how === "cut" ? "cut" : "shortcut", junction }).surface);
    } catch (e) {
      // The shortcut (or the autopilot after it) fails now and then; the cut takes over for that move.
      console.log(`move ${k}: ${how} failed (${String(e).slice(0, 100)}), cutting instead`);
      run = runAutopilot(applyChoice(before.copy(), { kind: "cut", junction }).surface);
    }
    fs = run.surface;
    console.log(`  move ${k} took ${((performance.now() - t) / 1000).toFixed(1)} s`);
  }
  console.log("end:", run.stoppedAt.kind, plainText(run.stoppedAt.description).slice(0, 300));
}

if (mode === "ref") {
  const [outDir] = args as [string];
  mkdirSync(outDir, { recursive: true });
  const byName = new Map(genus2PointPushTwists().map((m) => [m.name, m]));
  const word = ["D_d⁻¹", "D_c₁⁻¹", "D_a⁻¹"];
  const spec = { id: "ref", family: "ref", genus: 2, polygon: "a b A B c d C D", reversed: ["a", "b"], maps: word.map((n) => byName.get(n)!) };
  const fs = buildExample(spec);
  console.log("map on the rose:\n" + fs.g.toString());
  // Homology of the closed surface = H1 of the rose (the boundary word is a product of commutators).
  const letters = fs.graph.edges.map((e) => e.name);
  const H = letters.map(() => letters.map(() => 0));
  fs.graph.edges.forEach((e, j) => {
    for (const x of fs.g.image(e.forward).letters) (H[letters.indexOf(x.edge.name)] as number[])[j] += x.isForward ? 1 : -1;
  });
  const mul = (A: number[][], B: number[][]) => A.map((r) => B[0]!.map((_, j) => r.reduce((s, a, k) => s + a * B[k]![j]!, 0)));
  let P = H;
  const powers: Record<number, number[][]> = { 1: H };
  for (let n = 2; n <= 12; n++) powers[n] = P = mul(P, H);
  console.log("homology action (columns = images of", letters.join(","), "):", JSON.stringify(H));
  for (const n of [2, 3, 4, 6, 8, 12]) {
    const D = powers[n]!.map((r, i) => r.map((x, j) => x - (i === j ? 1 : 0)));
    console.log(`f^${n} − I =`, JSON.stringify(D));
  }
  const punctured = autopilot(fs.copy(), { maxSteps: 100000 });
  const s = punctured.stoppedAt;
  console.log("punctured lift stops at:", s.kind, plainText(s.description).slice(0, 600));
  console.log("graph after autopilot:\n" + punctured.surface.g.toString());
  for (const o of s.options.slice(0, 6)) console.log("option:", JSON.stringify(o.move), plainText(o.label).slice(0, 200));
  // Reduce along the first candidate to get the reduction curves in G₀.
  if (s.kind === "reducible" && s.options[0]) {
    const reduced = applyMove(punctured.surface.copy(), s.options[0].move);
    console.log("reduction curves in G₀:", reduced.reductionCurves.map(String));
    const after = autopilot(reduced, { maxSteps: 100000 });
    console.log("piece:", after.stoppedAt.kind, plainText(after.stoppedAt.description).slice(0, 300));
    console.log(after.surface.g.toString());
  }
  // The closed class on the punctured surface rel the puncture, and its 4th power.
  const pf = perronFrobenius(punctured.surface, { essentialOnly: true });
  console.log("growth of the punctured lift:", pf.growth);
  void (null as unknown as Vertex);
  void nextSuggestion;
  void AUTOMATIC;
}
