// The cut study's scheduler: `node coordinator.mjs <worker.mjs> <examples.json> <outDir> <hours> [workers]`.
//
// Each example is a tree: its root (the first decision after marking the surface closed), decision nodes (where the
// closed-surface suggestion is next), and expansions (one closed-surface choice, then the autopilot for everything
// else). The tree is shared: walks with different policies (default, always shortcut, largest period, random) reuse
// every expansion already made. Small trees are then filled breadth first, and the prongs near the root are compared.
//
// Results are appended to <outDir>/*.jsonl; node states are in <outDir>/nodes/<id>.json.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [workerPath, examplesPath, outDir, hoursArg, workersArg] = process.argv.slice(2);
const startTime = Date.now();
const deadline = startTime + Number(hoursArg) * 3600_000;
const maxWorkers = Number(workersArg ?? 14);
const MIN_FREE_MB = 900;
const TIMEOUT = { root: 20 * 60_000, expand: 45 * 60_000, analyze: 15 * 60_000 };
const RANDOM_WALKS = { preset: 24, known: 16, "g2-mixed": 4, "g2-twists": 2, "g3-mixed": 4 };
/** Expansions per example for the breadth-first fill (after the walks). */
const FILL_BUDGET = { preset: 250, known: 150, "g2-mixed": 40, "g2-twists": 10, "g3-mixed": 30 };
/** Nodes up to this depth get every prong of every orbit expanded. */
const PRONG_DEPTH = { preset: 1, known: 1, "g2-mixed": 0, "g2-twists": 0, "g3-mixed": 0 };
const MAX_DEPTH = 12;

mkdirSync(path.join(outDir, "nodes"), { recursive: true });
mkdirSync(path.join(outDir, "jobs"), { recursive: true });
const log = (file, record) => appendFileSync(path.join(outDir, file), JSON.stringify(record) + "\n");

const examples = JSON.parse(readFileSync(examplesPath, "utf8"));
const famPrio = (family) => ({ preset: 0, known: 1, "g2-mixed": 3, "g3-mixed": 4, "g2-twists": 5 })[family] ?? 6;

// ─── Job queue ──────────────────────────────────────────────────────────────────────────────

const queue = [];
let seq = 0;
let jobCounter = 0;
const running = new Map();

/** Runs a job in a worker process; resolves with its result (never rejects). */
function submit(prio, job) {
  return new Promise((resolve) => {
    queue.push({ prio, seq: seq++, job, resolve });
    pump();
  });
}

function launch(entry) {
  const id = jobCounter++;
  const jobPath = path.join(outDir, "jobs", `${id}.job.json`);
  const resultPath = path.join(outDir, "jobs", `${id}.result.json`);
  writeFileSync(jobPath, JSON.stringify(entry.job));
  const started = Date.now();
  const child = spawn(process.execPath, ["--max-old-space-size=4096", "--stack-size=8000", workerPath, jobPath, resultPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, TIMEOUT[entry.job.type]);
  running.set(id, { entry, started });
  child.on("exit", (code) => {
    clearTimeout(timer);
    running.delete(id);
    let result;
    if (existsSync(resultPath)) {
      try {
        result = JSON.parse(readFileSync(resultPath, "utf8"));
      } catch {
        result = undefined;
      }
    }
    if (result === undefined)
      result = { ok: false, error: timedOut ? "timeout" : `exit ${code}: ${stderr.slice(-800)}`, timeout: timedOut };
    try {
      unlinkSync(jobPath);
      if (existsSync(resultPath)) unlinkSync(resultPath);
    } catch {}
    entry.resolve({ ...result, wallMs: Date.now() - started });
    pump();
  });
}

const freeMB = () => os.freemem() / 2 ** 20;

function pump() {
  if (Date.now() > deadline) {
    // Past the deadline: everything waiting resolves as skipped.
    for (const entry of queue.splice(0)) entry.resolve({ ok: false, error: "deadline", skipped: true });
    return;
  }
  queue.sort((a, b) => a.prio - b.prio || a.seq - b.seq);
  while (queue.length > 0 && running.size < maxWorkers) {
    if (running.size > 0 && freeMB() < MIN_FREE_MB) break;
    launch(queue.shift());
  }
}

// ─── The shared tree ────────────────────────────────────────────────────────────────────────

let nodeCounter = 0;
const nodeFile = (id) => path.join(outDir, "nodes", `${id}.json`);
const choiceKey = (c) => JSON.stringify([c.kind, c.junction, c.prong ?? null, c.realBranches ?? null]);

/** Node: { id, example, family, depth, info, children: Map<key, Promise<Expansion>> }. */
const nodes = new Map();
const expansionsPerExample = new Map();

function makeNode(example, family, depth, info, parent, choice) {
  const id = nodeCounter++;
  const node = { id, example, family, depth, info, children: new Map(), prongs: undefined };
  nodes.set(id, node);
  return node;
}

/** The root of an example: a node, or a leaf if no cut is needed. */
async function root(example) {
  const id = nodeCounter++;
  const prio = famPrio(example.family) * 10;
  const result = await submit(prio, { type: "root", example, nodeOut: nodeFile(id) });
  log("roots.jsonl", { example: example.id, family: example.family, genus: example.genus, nodeId: id, ...result });
  if (!result.ok || !result.node) return undefined;
  const node = { id, example: example.id, family: example.family, depth: 0, info: result.node, children: new Map(), prongs: undefined };
  nodes.set(id, node);
  log("nodes.jsonl", { id, example: example.id, family: example.family, depth: 0, parent: null, choice: null, ...result.node });
  return node;
}

/** The expansion of `node` by `choice` (made once, shared by all walks). Resolves to { result, child? }. */
function expand(node, choice, extra = {}) {
  const key = choiceKey(choice);
  const existing = node.children.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const childId = nodeCounter++;
    expansionsPerExample.set(node.example, (expansionsPerExample.get(node.example) ?? 0) + 1);
    const prio = (extra.fill ? 100 : 0) + famPrio(node.family) * 10 + 1 + Math.min(node.depth, 8) * 0.1;
    const result = await submit(prio, { type: "expand", node: nodeFile(node.id), choice, nodeOut: nodeFile(childId) });
    const orbit = node.info.orbits.find((o) => o.junction === choice.junction);
    if (!result.skipped)
      log("expansions.jsonl", {
        id: childId,
        parent: node.id,
        example: node.example,
        family: node.family,
        depth: node.depth + 1,
        choice,
        period: orbit?.period,
        prongsPerSingularity: orbit?.prongsPerSingularity,
        parentPunctures: node.info.punctures,
        parentGrowth: node.info.growth,
        parentSize: node.info.size,
        ...extra,
        ...result,
      });
    let child;
    if (result.ok && result.node) {
      child = { id: childId, example: node.example, family: node.family, depth: node.depth + 1, info: result.node, children: new Map(), prongs: undefined };
      nodes.set(childId, child);
      log("nodes.jsonl", { id: childId, example: node.example, family: node.family, depth: node.depth + 1, parent: node.id, choice, ...result.node });
    }
    return { result, child };
  })();
  node.children.set(key, promise);
  return promise;
}

/** The choices at a node, in the order of the suggestion: cuts by period, then shortcuts by period. */
function choicesAt(node) {
  return [
    ...node.info.orbits.map((o) => ({ kind: "cut", junction: o.junction })),
    ...node.info.orbits.map((o) => ({ kind: "shortcut", junction: o.junction })),
  ];
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = (list, random) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** The policies: each orders the choices at a node; the walk takes the first that works. */
const POLICIES = {
  default: (node) => choicesAt(node),
  "shortcut-first": (node) => [...choicesAt(node).filter((c) => c.kind === "shortcut"), ...choicesAt(node).filter((c) => c.kind === "cut")],
  "cut-max-period": (node) => {
    const orbits = [...node.info.orbits].sort((a, b) => b.period - a.period);
    return [...orbits.map((o) => ({ kind: "cut", junction: o.junction })), ...orbits.map((o) => ({ kind: "shortcut", junction: o.junction }))];
  },
  "shortcut-max-period": (node) => {
    const orbits = [...node.info.orbits].sort((a, b) => b.period - a.period);
    return [...orbits.map((o) => ({ kind: "shortcut", junction: o.junction })), ...orbits.map((o) => ({ kind: "cut", junction: o.junction }))];
  },
  random: (node, random) => shuffle(choicesAt(node), random),
  "random-cut": (node, random) => [...shuffle(choicesAt(node).filter((c) => c.kind === "cut"), random), ...choicesAt(node).filter((c) => c.kind === "shortcut")],
};

async function walk(rootNode, policy, seed) {
  const random = rng(seed);
  const steps = [];
  let node = rootNode;
  let end;
  while (true) {
    if (node.depth >= MAX_DEPTH) {
      end = { kind: "max depth" };
      break;
    }
    const failures = [];
    let next;
    for (const choice of POLICIES[policy](node, random)) {
      const { result, child } = await expand(node, choice);
      if (result.skipped) {
        end = { kind: "deadline" };
        break;
      }
      if (!result.ok) {
        failures.push({ choice, error: result.timeout ? "timeout" : result.noCut ? "no cut" : String(result.error).split("\n")[0].slice(0, 160) });
        continue;
      }
      steps.push({
        node: node.id,
        punctures: node.info.punctures,
        growth: node.info.growth,
        strips: node.info.size.strips,
        choice,
        period: node.info.orbits.find((o) => o.junction === choice.junction)?.period,
        realBranches: result.cut?.realBranches,
        ms: result.ms,
        failures,
      });
      if (child) next = child;
      else end = { kind: "leaf", outcome: result.outcome };
      break;
    }
    if (end) break;
    if (!next) {
      end = { kind: "stuck", failures };
      break;
    }
    node = next;
  }
  log("walks.jsonl", {
    example: rootNode.example,
    family: rootNode.family,
    policy,
    seed,
    cuts: steps.length,
    punctures: [...steps.map((s) => s.punctures), end.outcome?.punctures],
    totalMs: steps.reduce((t, s) => t + (s.ms ?? 0), 0),
    steps,
    end,
  });
}

/** Every prong of every orbit at a node (needs the analysis first). */
async function prongAlternatives(node) {
  const prio = famPrio(node.family) * 10 + 2 + node.depth * 0.1;
  const result = await submit(prio, { type: "analyze", node: nodeFile(node.id) });
  log("analyses.jsonl", { node: node.id, example: node.example, family: node.family, depth: node.depth, punctures: node.info.punctures, ...result });
  if (!result.ok) return;
  const byOrbit = new Map();
  for (const p of result.prongs) {
    if (p.realBranches === undefined) continue;
    byOrbit.set(p.orbitJunction, [...(byOrbit.get(p.orbitJunction) ?? []), p]);
  }
  const jobs = [];
  for (const [, list] of byOrbit) {
    const best = Math.min(...list.map((p) => p.realBranches));
    for (const p of list)
      jobs.push(
        expand(node, { kind: "cut", junction: p.orbitJunction, prong: p.index, realBranches: p.realBranches }, {
          prongAlternative: true,
          prongJunction: p.junction,
          bestLength: best,
        }),
      );
  }
  await Promise.all(jobs);
}

/** Breadth-first fill of the tree (cuts and shortcuts at every orbit) within the example's budget. */
async function fill(rootNode, budget) {
  let level = [rootNode];
  while (level.length > 0 && Date.now() < deadline) {
    const next = [];
    await Promise.all(
      level.flatMap((node) =>
        node.depth >= MAX_DEPTH
          ? []
          : choicesAt(node).map(async (choice) => {
              if (!node.children.has(choiceKey(choice)) && (expansionsPerExample.get(node.example) ?? 0) >= budget) return;
              const { child } = await expand(node, choice, { fill: true });
              if (child) next.push(child);
            }),
      ),
    );
    level = next;
  }
}

async function study(example) {
  const rootNode = await root(example);
  if (!rootNode) return;
  const family = example.family;
  const walks = [
    walk(rootNode, "default", 0),
    walk(rootNode, "shortcut-first", 0),
    walk(rootNode, "cut-max-period", 0),
    walk(rootNode, "shortcut-max-period", 0),
  ];
  const n = RANDOM_WALKS[family] ?? 2;
  for (let k = 1; k <= n; k++) walks.push(walk(rootNode, k % 2 === 0 ? "random-cut" : "random", k));
  // The prongs of the root (and of its children, for the presets) are compared.
  const prongDepth = PRONG_DEPTH[family] ?? 0;
  const prongStudy = (async () => {
    await prongAlternatives(rootNode);
    if (prongDepth >= 1) {
      const children = await Promise.all([...rootNode.children.values()]);
      await Promise.all(children.filter((c) => c.child).map((c) => prongAlternatives(c.child)));
    }
  })();
  await Promise.all(walks);
  await fill(rootNode, FILL_BUDGET[family] ?? 10);
  await prongStudy;
  log("done.jsonl", { example: example.id, t: Date.now() - startTime, expansions: expansionsPerExample.get(example.id) ?? 0 });
}

setInterval(() => {
  const status = {
    t: new Date().toISOString(),
    elapsedMin: Math.round((Date.now() - startTime) / 60000),
    running: running.size,
    queued: queue.length,
    freeMB: Math.round(freeMB()),
    jobs: jobCounter,
    nodes: nodes.size,
    runningJobs: [...running.values()].map(({ entry, started }) => ({
      type: entry.job.type,
      example: entry.job.example?.id ?? entry.job.node,
      secs: Math.round((Date.now() - started) / 1000),
    })),
  };
  writeFileSync(path.join(outDir, "status.json"), JSON.stringify(status, null, 1));
  pump();
}, 10_000);

await Promise.all(examples.map((e) => study(e).catch((err) => log("events.jsonl", { example: e.id, error: String(err.stack ?? err) }))));
log("events.jsonl", { event: "finished", t: Date.now() - startTime });
process.exit(0);
