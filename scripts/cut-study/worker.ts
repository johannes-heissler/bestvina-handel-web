/**
 * One job of the cut study per process: `node worker.mjs <job.json> <result.json>`.
 *
 * - root: build an example, run the autopilot (without the closed-surface moves), mark as closed if offered, and
 *   return the first decision node (or the outcome if no cut is needed).
 * - expand: apply one closed-surface choice to a node, run the autopilot to the next decision or the end.
 * - analyze: the cut length of every prong of a node.
 * - selftest: serialization round trip.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  analyzeProngs,
  applyChoice,
  buildExample,
  type Choice,
  deserialize,
  type ExampleSpec,
  nextSuggestion,
  nodeInfo,
  NoCut,
  outcomeOf,
  runAutopilot,
  serialize,
  type SerializedSurface,
} from "./study";
import { applyMove } from "../../src/fibred/move";
import { perronFrobenius } from "../../src/fibred/perron-frobenius";

const growthOf = (fs: Parameters<typeof perronFrobenius>[0]) => {
  try {
    return perronFrobenius(fs, { essentialOnly: true }).growth;
  } catch {
    return undefined;
  }
};

type Job =
  | { type: "root"; example: ExampleSpec; nodeOut: string }
  | { type: "expand"; node: string; choice: Choice; nodeOut: string }
  | { type: "analyze"; node: string }
  | { type: "selftest"; example: ExampleSpec }
  | { type: "replay"; example: ExampleSpec; path: Choice[] };

const [jobPath, resultPath] = process.argv.slice(2) as [string, string];
const job = JSON.parse(readFileSync(jobPath, "utf8")) as Job;
const warnings: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  if (warnings.length < 20) warnings.push(args.map(String).join(" ").slice(0, 300));
};

function write(result: object) {
  writeFileSync(resultPath, JSON.stringify({ ...result, warnings, memoryMB: process.memoryUsage().rss / 2 ** 20 }));
}

function emitNodeOrLeaf(surface: ReturnType<typeof runAutopilot>["surface"], stoppedAt: ReturnType<typeof runAutopilot>["stoppedAt"], nodeOut: string) {
  const outcome = outcomeOf(surface, stoppedAt);
  if (stoppedAt.kind === "closed surface") {
    writeFileSync(nodeOut, JSON.stringify(serialize(surface)));
    return { outcome, node: nodeInfo(surface) };
  }
  return { outcome };
}

try {
  const t0 = performance.now();
  switch (job.type) {
    case "root": {
      const fs = buildExample(job.example);
      const problems = fs.checkIntegrity();
      if (problems.length > 0) {
        write({ ok: false, error: `invalid map: ${problems.join("; ").slice(0, 300)}` });
        break;
      }
      const start = { strips: fs.graph.edgeCount, map: fs.toString().slice(0, 2000) };
      const punctured = runAutopilot(fs);
      const puncturedOutcome = outcomeOf(punctured.surface, punctured.stoppedAt);
      if (punctured.stoppedAt.kind === "closed surface") {
        write({ ok: true, start, punctured: { run: punctured.info }, marked: false, alreadyClosed: true, closedRun: punctured.info, ...emitNodeOrLeaf(punctured.surface, punctured.stoppedAt, job.nodeOut), ms: performance.now() - t0 });
        break;
      }
      const canMark = punctured.stoppedAt.options.some((o) => o.move.kind === "mark as closed");
      if (!canMark) {
        write({ ok: true, start, punctured: { outcome: puncturedOutcome, run: punctured.info }, marked: false, ms: performance.now() - t0 });
        break;
      }
      const marked = applyMove(punctured.surface, { kind: "mark as closed" });
      const closed = runAutopilot(marked);
      write({
        ok: true,
        start,
        punctured: { outcome: puncturedOutcome, run: punctured.info },
        marked: true,
        closedRun: closed.info,
        ...emitNodeOrLeaf(closed.surface, closed.stoppedAt, job.nodeOut),
        ms: performance.now() - t0,
      });
      break;
    }
    case "expand": {
      const fs = deserialize(JSON.parse(readFileSync(job.node, "utf8")) as SerializedSurface);
      let applied;
      try {
        applied = applyChoice(fs, job.choice);
      } catch (e) {
        write({
          ok: false,
          error: (e as Error).message.slice(0, 500),
          noCut: e instanceof NoCut || /No cut found/.test((e as Error).message),
          ms: performance.now() - t0,
        });
        break;
      }
      const { surface, ...cutInfo } = applied;
      const problems = surface.checkIntegrity();
      const after = { growth: growthOf(surface), size: { strips: surface.graph.edgeCount, junctions: surface.graph.vertexCount } };
      if (problems.length > 0) {
        write({ ok: false, error: `after the move: ${problems.join("; ").slice(0, 400)}`, cut: cutInfo, ms: performance.now() - t0 });
        break;
      }
      const run = runAutopilot(surface);
      write({ ok: true, cut: cutInfo, afterMove: after, run: run.info, ...emitNodeOrLeaf(run.surface, run.stoppedAt, job.nodeOut), ms: performance.now() - t0 });
      break;
    }
    case "analyze": {
      const fs = deserialize(JSON.parse(readFileSync(job.node, "utf8")) as SerializedSurface);
      write({ ok: true, prongs: analyzeProngs(fs), ms: performance.now() - t0 });
      break;
    }
    case "replay": {
      // The path in one process, without serialization (to tell the harness from the app).
      let surface = buildExample(job.example);
      let run = runAutopilot(surface);
      if (run.stoppedAt.kind !== "closed surface") run = runAutopilot(applyMove(run.surface, { kind: "mark as closed" }));
      const steps: object[] = [];
      for (const choice of job.path) {
        try {
          surface = applyChoice(run.surface, choice).surface;
          run = runAutopilot(surface);
          steps.push({ ok: true, kind: run.stoppedAt.kind });
        } catch (e) {
          steps.push({ ok: false, error: String((e as Error).stack).slice(0, 1500) });
          break;
        }
      }
      write({ ok: true, steps, ms: performance.now() - t0 });
      break;
    }
    case "selftest": {
      const fs = buildExample(job.example);
      const punctured = runAutopilot(fs);
      const marked = applyMove(punctured.surface, { kind: "mark as closed" });
      const closed = runAutopilot(marked).surface;
      const copy = deserialize(serialize(closed));
      const same = copy.toString() === closed.toString();
      const kind = nextSuggestion(copy).kind;
      const info = [nodeInfo(closed), nodeInfo(copy)].map((i) => JSON.stringify(i));
      const choice: Choice = { kind: "cut", junction: nodeInfo(closed).orbits[0]!.junction };
      const r1 = runAutopilot(applyChoice(closed.copy(), choice).surface);
      const r2 = runAutopilot(applyChoice(copy, choice).surface);
      write({
        ok: true,
        same,
        kind,
        infoSame: info[0] === info[1],
        afterSame: r1.surface.toString() === r2.surface.toString(),
        k1: r1.stoppedAt.kind,
        k2: r2.stoppedAt.kind,
        ms: performance.now() - t0,
      });
      break;
    }
  }
} catch (e) {
  write({ ok: false, error: String((e as Error).stack ?? e).slice(0, 1500) });
}
console.error = origError;
