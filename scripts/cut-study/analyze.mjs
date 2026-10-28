// Aggregates the cut study's logs: `node analyze.mjs <dataDir> <out.json>`; prints a text summary too.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [dir, outPath] = process.argv.slice(2);
const read = (f) => {
  const p = path.join(dir, f);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
};
const roots = read("roots.jsonl");
const nodes = read("nodes.jsonl");
const expansions = read("expansions.jsonl");
const walks = read("walks.jsonl");
const analyses = read("analyses.jsonl");

const count = (list, key) => {
  const c = {};
  for (const x of list) {
    const k = typeof key === "function" ? key(x) : x[key];
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
};
const quantiles = (xs, qs = [0, 0.25, 0.5, 0.75, 0.9, 1]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? [] : qs.map((q) => s[Math.round(q * (s.length - 1))]);
};
const familyOf = new Map(roots.map((r) => [r.example, r.family]));
const genusOf = new Map(roots.map((r) => [r.example, r.genus]));

// ─── 1. Roots: which examples need the closed-surface move at all ─────────────────────────
const rootClass = (r) => {
  if (!r.ok) return r.timeout ? "timeout" : "error";
  if (r.node) return r.alreadyClosed ? "closed preset: needs a cut" : "needs a cut (1 cusp)";
  const o = r.punctured?.outcome;
  if (!o) return "?";
  if (o.kind === "finished") return `${o.classification ?? "?"} (punctured), cusps ${JSON.stringify(o.shape?.punctureCusps)}`.replace(/, cusps \[\d+\]/, (m) => (/\[1\]/.test(m) ? m : ", ≥2 cusps"));
  return o.kind;
};
const rootSummary = {};
for (const r of roots) {
  const fam = r.family;
  rootSummary[fam] ??= {};
  const k = rootClass(r);
  rootSummary[fam][k] = (rootSummary[fam][k] ?? 0) + 1;
}

// ─── 1b. The closed class from the twist-only reference ──────────────────────────────────
const rootByExample = new Map(roots.map((r) => [r.example, r]));
function closedClass(example) {
  const ref = rootByExample.get(example.startsWith("ref:") ? example : `ref:${example}`);
  if (!ref) return { kind: "no reference" };
  if (!ref.ok) return { kind: "reference failed" };
  const o = ref.punctured?.outcome;
  if (ref.node || ref.alreadyClosed) return { kind: "unknown (reference has 1 cusp)" };
  if (!o) return { kind: "?" };
  if (o.kind === "reducible") return { kind: "not pA (reducible)" };
  if (o.classification === "finite order") return { kind: "not pA (finite order)" };
  if (o.classification === "pseudo-Anosov") return { kind: "pA", growth: o.pAGrowth };
  return { kind: `? ${o.kind} ${o.classification ?? ""}` };
}

// ─── 2. Walks: cuts per example and policy ────────────────────────────────────────────────
const finishedWalk = (w) => w.end.kind === "leaf";
const endLabel = (w) =>
  w.end.kind === "leaf"
    ? w.end.outcome.kind === "finished"
      ? w.end.outcome.classification
      : w.end.outcome.kind
    : w.end.kind;
const byExample = new Map();
for (const w of walks) {
  const list = byExample.get(w.example) ?? [];
  list.push(w);
  byExample.set(w.example, list);
}
const exampleRows = [];
for (const [example, ws] of byExample) {
  const done = ws.filter(finishedWalk);
  const cuts = done.map((w) => w.cuts);
  const growths = [...new Set(done.filter((w) => w.end.outcome.pAGrowth).map((w) => w.end.outcome.pAGrowth.toFixed(6)))];
  const dflt = ws.find((w) => w.policy === "default");
  const maxP = Math.max(...ws.flatMap((w) => w.punctures.filter((p) => p != null)));
  exampleRows.push({
    example,
    family: familyOf.get(example),
    genus: genusOf.get(example),
    walks: ws.length,
    finished: done.length,
    minCuts: cuts.length ? Math.min(...cuts) : null,
    maxCuts: cuts.length ? Math.max(...cuts) : null,
    maxCutsAny: Math.max(...ws.map((w) => w.cuts)),
    defaultCuts: dflt && finishedWalk(dflt) ? dflt.cuts : null,
    defaultEnd: dflt ? endLabel(dflt) : null,
    defaultPunctures: dflt?.punctures,
    ends: count(ws, endLabel),
    pAGrowths: growths,
    maxPunctures: maxP,
    closedClass: closedClass(example),
    policyCuts: Object.fromEntries(
      ["default", "shortcut-first", "cut-max-period", "shortcut-max-period"].map((p) => {
        const w = ws.find((x) => x.policy === p);
        return [p, w ? { cuts: w.cuts, end: endLabel(w), ms: Math.round(w.totalMs), punctures: w.punctures } : null];
      }),
    ),
  });
}
exampleRows.sort((a, b) => b.maxCutsAny - a.maxCutsAny);

// ─── 3. Shortcut vs cut on the same orbit at the same node ────────────────────────────────
const byParent = new Map();
for (const e of expansions) {
  const list = byParent.get(e.parent) ?? [];
  list.push(e);
  byParent.set(e.parent, list);
}
const pairs = [];
for (const [, list] of byParent) {
  for (const cut of list.filter((e) => e.choice.kind === "cut" && e.choice.prong === undefined)) {
    const sc = list.find((e) => e.choice.kind === "shortcut" && e.choice.junction === cut.choice.junction);
    if (!sc) continue;
    pairs.push({
      example: cut.example,
      family: cut.family,
      depth: cut.depth,
      period: cut.period,
      parentPunctures: cut.parentPunctures,
      parentStrips: cut.parentSize?.strips,
      cut: summarizeExpansion(cut),
      shortcut: summarizeExpansion(sc),
    });
  }
}
function summarizeExpansion(e) {
  return {
    ok: e.ok,
    error: e.ok ? undefined : e.timeout ? "timeout" : e.noCut ? "no cut" : String(e.error).split("\n")[0].slice(0, 120),
    ms: e.ms,
    moveMs: e.cut?.moveMs,
    optionsMs: e.cut?.optionsMs,
    runMs: e.run?.ms,
    runMoves: e.run?.moves,
    runByKind: e.run?.byKind,
    realBranches: e.cut?.realBranches,
    afterMoveStrips: e.afterMove?.size?.strips,
    afterMoveGrowth: e.afterMove?.growth,
    outKind: e.outcome?.kind,
    outClass: e.outcome?.classification,
    outGrowth: e.outcome?.growth,
    outPunctures: e.outcome?.punctures,
    outStrips: e.outcome?.size?.strips,
  };
}
const bothOk = pairs.filter((p) => p.cut.ok && p.shortcut.ok);
const pairStats = {
  pairs: pairs.length,
  bothOk: bothOk.length,
  onlyCutOk: pairs.filter((p) => p.cut.ok && !p.shortcut.ok).length,
  onlyShortcutOk: pairs.filter((p) => !p.cut.ok && p.shortcut.ok).length,
  neither: pairs.filter((p) => !p.cut.ok && !p.shortcut.ok).length,
  sameOutcomeKind: bothOk.filter((p) => p.cut.outKind === p.shortcut.outKind).length,
  sameGrowth: bothOk.filter((p) => Math.abs((p.cut.outGrowth ?? 0) - (p.shortcut.outGrowth ?? 0)) < 1e-6).length,
  samePunctures: bothOk.filter((p) => p.cut.outPunctures === p.shortcut.outPunctures).length,
  sameStrips: bothOk.filter((p) => p.cut.outStrips === p.shortcut.outStrips).length,
  msCut: quantiles(bothOk.map((p) => p.cut.ms)),
  msShortcut: quantiles(bothOk.map((p) => p.shortcut.ms)),
  ratioMs: quantiles(bothOk.map((p) => p.cut.ms / Math.max(1, p.shortcut.ms))),
  runMovesCut: quantiles(bothOk.map((p) => p.cut.runMoves)),
  runMovesShortcut: quantiles(bothOk.map((p) => p.shortcut.runMoves)),
  shortcutFaster: bothOk.filter((p) => p.shortcut.ms < p.cut.ms).length,
  shortcutErrors: count(pairs.filter((p) => !p.shortcut.ok), (p) => p.shortcut.error.replace(/[a-z]_?[\w₀-₉]*/gi, (m) => (m.length <= 6 ? "·" : m)).slice(0, 80)),
  cutErrors: count(pairs.filter((p) => !p.cut.ok), (p) => p.cut.error.slice(0, 80)),
};

// ─── 4. Orbit choice: does the choice of q change how many cuts are needed? ───────────────
// Remaining cuts below a node along fully explored children: min and max over the finished leaves reached.
const children = new Map();
for (const e of expansions) {
  const list = children.get(e.parent) ?? [];
  list.push(e);
  children.set(e.parent, list);
}
const memo = new Map();
function remaining(id) {
  if (memo.has(id)) return memo.get(id);
  memo.set(id, null);
  const kids = (children.get(id) ?? []).filter((e) => e.ok && e.choice.prong === undefined);
  let min = Infinity;
  let max = -Infinity;
  for (const e of kids) {
    if (e.outcome?.kind === "closed surface") {
      const r = remaining(e.id);
      if (r === null) continue;
      min = Math.min(min, 1 + r.min);
      max = Math.max(max, 1 + r.max);
    } else {
      min = Math.min(min, 1);
      max = Math.max(max, 1);
    }
  }
  const r = min === Infinity ? null : { min, max };
  memo.set(id, r);
  return r;
}
const rootNodes = roots.filter((r) => r.ok && r.node);
const treeRows = rootNodes
  .map((r) => ({ example: r.example, family: r.family, ...(remaining(r.nodeId) ?? {}) }))
  .filter((r) => r.min !== undefined);

// ─── 5. Prongs: spread of the lengths of L within an orbit, and alternative prongs ────────
const prongRows = [];
for (const a of analyses.filter((a) => a.ok)) {
  const byOrbit = new Map();
  for (const p of a.prongs) byOrbit.set(p.orbitJunction, [...(byOrbit.get(p.orbitJunction) ?? []), p]);
  for (const [orbit, list] of byOrbit) {
    const lengths = list.filter((p) => p.realBranches !== undefined).map((p) => p.realBranches);
    prongRows.push({
      example: a.example,
      family: a.family,
      depth: a.depth,
      punctures: a.punctures,
      orbit,
      prongs: list.length,
      found: lengths.length,
      failures: count(list.filter((p) => p.realBranches === undefined), "failure"),
      min: lengths.length ? Math.min(...lengths) : null,
      max: lengths.length ? Math.max(...lengths) : null,
      lengths,
      within2x: lengths.filter((l) => l < 2 * Math.min(...lengths)).length,
      ms: a.ms,
    });
  }
}
// Alternative prongs vs the default one at the same orbit.
const prongAlt = [];
for (const [, list] of byParent) {
  for (const alt of list.filter((e) => e.prongAlternative)) {
    const dflt = list.find((e) => e.choice.kind === "cut" && e.choice.prong === undefined && e.choice.junction === alt.choice.junction);
    prongAlt.push({
      example: alt.example,
      depth: alt.depth,
      length: alt.choice.realBranches,
      best: alt.bestLength,
      ok: alt.ok,
      error: alt.ok ? undefined : alt.timeout ? "timeout" : String(alt.error).split("\n")[0].slice(0, 100),
      ms: alt.ms,
      outKind: alt.outcome?.kind,
      outGrowth: alt.outcome?.growth,
      outPunctures: alt.outcome?.punctures,
      outStrips: alt.outcome?.size?.strips,
      defaultOk: dflt?.ok,
      defaultMs: dflt?.ms,
      defaultKind: dflt?.outcome?.kind,
      defaultGrowth: dflt?.outcome?.growth,
      defaultStrips: dflt?.outcome?.size?.strips,
      sameAsDefault: dflt?.ok && alt.ok && dflt.outcome?.kind === alt.outcome?.kind && Math.abs((dflt.outcome?.growth ?? 0) - (alt.outcome?.growth ?? 0)) < 1e-6,
    });
  }
}

// ─── 6. Punctures and growth along cut chains (the deepest walks) ─────────────────────────
const chains = walks
  .filter((w) => w.cuts >= 3)
  .map((w) => ({
    example: w.example,
    family: w.family,
    policy: w.policy,
    seed: w.seed,
    cuts: w.cuts,
    end: endLabel(w),
    punctures: w.punctures,
    growth: [...w.steps.map((s) => s.growth), w.end.outcome?.growth ?? null],
    strips: w.steps.map((s) => s.strips),
    periods: w.steps.map((s) => s.period),
    kinds: w.steps.map((s) => s.choice.kind),
    realBranches: w.steps.map((s) => s.realBranches ?? null),
    secs: w.steps.map((s) => Math.round((s.ms ?? 0) / 100) / 10),
  }))
  .sort((a, b) => b.cuts - a.cuts);

// ─── 7. Expansion costs ───────────────────────────────────────────────────────────────────
const expansionCosts = expansions
  .filter((e) => e.ok)
  .map((e) => ({
    kind: e.choice.kind,
    family: e.family,
    depth: e.depth,
    period: e.period,
    parentPunctures: e.parentPunctures,
    parentStrips: e.parentSize?.strips,
    realBranches: e.cut?.realBranches,
    optionsMs: e.cut?.optionsMs,
    moveMs: e.cut?.moveMs,
    runMs: e.run?.ms,
    ms: e.ms,
    runMoves: e.run?.moves,
    outStrips: e.outcome?.size?.strips,
    outKind: e.outcome?.kind,
  }));
const failures = count(
  expansions.filter((e) => !e.ok),
  (e) => `${e.choice.kind}: ${e.timeout ? "timeout" : e.noCut ? "no cut found" : String(e.error).split("\n")[0].replace(/(junction|star of|edges) [^ ]+( [^ ]+)?/g, "$1 …").slice(0, 90)}`,
);

// Do the cut chains end, by the closed class?
const chainVsClass = count(exampleRows.filter((r) => !r.example.startsWith("ref:")), (r) => `${r.family} | closed: ${r.closedClass.kind} | default: ${r.defaultEnd} | any finished: ${r.finished > 0}`);
const growthCheck = exampleRows
  .filter((r) => r.closedClass.kind === "pA" && r.pAGrowths.length > 0)
  .map((r) => ({ example: r.example, ref: r.closedClass.growth, found: r.pAGrowths.map(Number), agree: r.pAGrowths.every((g) => Math.abs(Number(g) - r.closedClass.growth) < 1e-5) }));
const summary = {
  chainVsClass,
  growthCheck,
  generated: new Date().toISOString(),
  counts: { roots: roots.length, nodes: nodes.length, expansions: expansions.length, walks: walks.length, analyses: analyses.length },
  rootSummary,
  exampleRows,
  pairStats,
  pairs: pairs.map(({ example, family, depth, period, parentPunctures, parentStrips, cut, shortcut }) => ({
    example, family, depth, period, parentPunctures, parentStrips,
    cutOk: cut.ok, scOk: shortcut.ok, cutMs: cut.ms, scMs: shortcut.ms, cutRunMoves: cut.runMoves, scRunMoves: shortcut.runMoves,
    cutKind: cut.outKind, scKind: shortcut.outKind, cutGrowth: cut.outGrowth, scGrowth: shortcut.outGrowth,
    cutStrips: cut.outStrips, scStrips: shortcut.outStrips, cutAfterMoveStrips: cut.afterMoveStrips, scAfterMoveStrips: shortcut.afterMoveStrips,
    cutError: cut.error, scError: shortcut.error, realBranches: cut.realBranches,
  })),
  treeRows,
  prongRows,
  prongAlt,
  chains: chains.slice(0, 400),
  expansionCosts,
  failures,
  walkEnds: count(walks, (w) => `${w.family} ${w.policy.startsWith("random") ? "random*" : w.policy}: ${endLabel(w)}`),
};
writeFileSync(outPath, JSON.stringify(summary));

// ─── Text summary ─────────────────────────────────────────────────────────────────────────
console.log("counts", summary.counts);
console.log("roots", JSON.stringify(rootSummary, null, 1));
console.log("pairs", JSON.stringify({ ...pairStats }, null, 1));
console.log("failures", failures);
console.log("chain vs closed class", chainVsClass);
console.log("growth check", growthCheck.length, "agree", growthCheck.filter((g) => g.agree).length, growthCheck.filter((g) => !g.agree).slice(0, 5));
console.log("examples by max cuts (top 25):");
for (const r of exampleRows.slice(0, 25))
  console.log(
    r.example.padEnd(30),
    `walks ${r.walks} fin ${r.finished} cuts ${r.minCuts}-${r.maxCuts} (any ${r.maxCutsAny}) default ${r.defaultCuts} ${r.defaultEnd} maxP ${r.maxPunctures} λ ${r.pAGrowths.join("/")}`,
  );
console.log("trees (min/max remaining cuts):", treeRows.filter((t) => t.max > 1).slice(0, 30));
console.log("prong rows", prongRows.length, "with spread:", prongRows.filter((p) => p.max > p.min).length);
console.log("prong alternatives", prongAlt.length, "same as default", prongAlt.filter((p) => p.sameAsDefault).length);
