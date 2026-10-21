// Builds the HTML report of the cut study: `node build-report.mjs <summary.json> <out.html> [extra.json]`.
// The data is embedded; the page draws its charts with inline SVG.
import { readFileSync, writeFileSync } from "node:fs";

const [summaryPath, outPath, extraPath] = process.argv.slice(2);
const s = JSON.parse(readFileSync(summaryPath, "utf8"));
const extra = extraPath ? JSON.parse(readFileSync(extraPath, "utf8")) : {};

// ─── Data for the page ──────────────────────────────────────────────────────────────────────
const FAMILIES = [
  ["g2-mixed", "Genus 2, pushes and twists mixed"],
  ["g2-twistpush", "Genus 2, twist word + 1–3 pushes"],
  ["g2-twists", "Genus 2, twists only"],
  ["g3-mixed", "Genus 3, pushes and twists mixed"],
  ["g3-twistpush", "Genus 3, twist word + 2 pushes"],
  ["ref-g2", "Genus 2, closed-class references"],
  ["ref-g3", "Genus 3, closed-class references"],
];
const bucket = (k) =>
  /needs a cut/.test(k) ? "cut" : /^pseudo-Anosov/.test(k) ? "pA" : /^reducible|disconnected/.test(k) ? "red" : /^finite/.test(k) ? "fin" : "other";
const census = FAMILIES.filter(([f]) => s.rootSummary[f]).map(([f, label]) => {
  const row = { family: f, label, cut: 0, pA: 0, red: 0, fin: 0, other: 0 };
  for (const [k, n] of Object.entries(s.rootSummary[f])) row[bucket(k)] += n;
  return row;
});

// The longest chain per (example, first choice).
const chains = [];
const seen = new Set();
for (const c of s.chains) {
  const key = `${c.example}|${c.punctures.slice(0, 3).join(",")}`;
  if (seen.has(key)) continue;
  seen.add(key);
  chains.push(c);
}

const data = {
  generated: s.generated,
  counts: s.counts,
  census,
  pairStats: s.pairStats,
  pairs: s.pairs.filter((p) => p.cutOk || p.scOk),
  prongRows: s.prongRows,
  prongAlt: s.prongAlt,
  chains: chains.slice(0, 12),
  failures: s.failures,
  exampleRows: s.exampleRows.slice(0, 40),
  growthCheck: s.growthCheck,
  chainVsClass: s.chainVsClass,
  ...extra,
};

const html = `<title>Cut Move Study</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
/* Layout: one reading column (~44rem) for prose; figures and tables may use the full 64rem measure. */
:root {
  --bg: #f7f8f9; --surface: #ffffff; --fg: #15191d; --fg-2: #4a525b; --fg-3: #7a838c;
  --rule: #d9dee3; --grid: #e8ecef; --accent: #2a5f9e; --code-bg: #eef1f4;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s7: #6250d6; --s-other: #a3abb3;
  --warn: #b25e00;
  --f-display: "IBM Plex Sans Condensed", "Arial Narrow", sans-serif;
  --f-body: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121518; --surface: #1a1e22; --fg: #e9ecef; --fg-2: #b4bcc4; --fg-3: #87909a;
  --rule: #30363c; --grid: #262b31; --accent: #7fb0ec; --code-bg: #22272d;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s7: #9085e9; --s-other: #69727b;
  --warn: #e3a04f; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #121518; --surface: #1a1e22; --fg: #e9ecef; --fg-2: #b4bcc4; --fg-3: #87909a;
  --rule: #30363c; --grid: #262b31; --accent: #7fb0ec; --code-bg: #22272d;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s7: #9085e9; --s-other: #69727b;
  --warn: #e3a04f; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 var(--f-body); }
main { max-width: 64rem; margin: 0 auto; padding-block: 2.5rem 4rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex; flex-direction: column; gap: 2.75rem; }
header { display: flex; flex-direction: column; gap: .6rem; max-width: 46rem; }
.eyebrow { font: 500 .75rem/1 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); }
h1 { font: 600 2.4rem/1.1 var(--f-display); margin: 0; text-wrap: balance; }
h2 { font: 600 1.45rem/1.2 var(--f-display); margin: 0; text-wrap: balance; }
h3 { font: 600 1.05rem/1.3 var(--f-body); margin: 0; }
p { margin: 0; max-width: 46rem; }
.lede { font-size: 1.08rem; color: var(--fg-2); }
section { display: flex; flex-direction: column; gap: 1rem; }
.status { display: inline-flex; gap: .5rem; align-items: center; font: 500 .8rem/1.2 var(--f-mono); color: var(--warn);
  border: 1px solid currentColor; border-radius: 3px; padding: .25rem .5rem; align-self: flex-start; }
.findings { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1rem; }
.finding { background: var(--surface); border: 1px solid var(--rule); border-radius: 4px; padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: .4rem; min-width: 0; }
.finding .big { font: 500 1.6rem/1.1 var(--f-mono); font-variant-numeric: tabular-nums; }
.finding p { font-size: .92rem; color: var(--fg-2); }
figure { margin: 0; background: var(--surface); border: 1px solid var(--rule); border-radius: 4px; padding: 1rem; display: flex; flex-direction: column; gap: .6rem; min-width: 0; }
figcaption { font-size: .88rem; color: var(--fg-2); max-width: 46rem; }
.figrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); gap: 1rem; }
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.chart text { fill: var(--fg-2); font: 11px var(--f-mono); }
.chart .axis-title { fill: var(--fg-3); font: 11px var(--f-body); }
.chart .grid { stroke: var(--grid); stroke-width: 1; }
.chart .baseline { stroke: var(--fg-3); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font-size: .82rem; color: var(--fg-2); }
.legend span { display: inline-flex; align-items: center; gap: .35rem; }
.legend i { width: .7rem; height: .7rem; border-radius: 2px; display: inline-block; }
.tablewrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--rule); border-radius: 4px; }
table { border-collapse: collapse; width: 100%; font-size: .84rem; }
th, td { text-align: left; padding: .45rem .7rem; border-bottom: 1px solid var(--grid); vertical-align: top; }
th { font: 600 .75rem/1.3 var(--f-body); color: var(--fg-3); text-transform: uppercase; letter-spacing: .04em; background: var(--surface); }
td.num, th.num { text-align: right; font-family: var(--f-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
td.mono { font-family: var(--f-mono); font-size: .8rem; }
code { font: .85em var(--f-mono); background: var(--code-bg); padding: .05rem .3rem; border-radius: 3px; }
.math { font-style: italic; }
ul { margin: 0; padding-left: 1.2rem; max-width: 46rem; display: flex; flex-direction: column; gap: .35rem; }
#tip { position: fixed; pointer-events: none; background: var(--surface); color: var(--fg); border: 1px solid var(--rule);
  border-radius: 4px; padding: .4rem .6rem; font: .8rem/1.35 var(--f-body); box-shadow: 0 2px 10px rgb(0 0 0 / .12); z-index: 20; max-width: 18rem; }
#tip b { font-family: var(--f-mono); font-weight: 500; }
.note { font-size: .85rem; color: var(--fg-3); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>

<main>
  <header>
    <span class="eyebrow">Bestvina–Handel web · closed-surface move</span>
    <h1>Cut Move Study</h1>
    <p class="lede">How many cuts does the closed-surface move need, how fast do the artificial punctures multiply, and does
    the shortcut (filling the puncture) or the choice of singular orbit and prong change that? Every other step runs on the autopilot.</p>
    <span class="status" id="status"></span>
  </header>

  <section>
    <h2>Main findings so far</h2>
    <div class="findings" id="findings"></div>
  </section>

  <section>
    <h2>Cut chains that never end</h2>
    <p>The start-menu example <em>Point push with Dehn twists</em> never reaches a classification: every closed-surface move
    leaves an orbit of punctures that again have one cusp each. After the first move there is only one singular orbit, so the
    chain is forced. The puncture count grows by exactly 4 per step, and λ falls towards 1.</p>
    <div class="figrow">
      <figure>
        <div class="legend" id="leg-chain"></div>
        <svg class="chart" id="ch-punctures" viewBox="0 0 460 260" role="img" aria-label="Punctures after each closed-surface move"></svg>
        <figcaption>Punctures after each closed-surface move. The two lines are the two choices at the first move (orbit of period 2 or 3);
        both then gain 4 punctures per move until the depth limit of 12 moves.</figcaption>
      </figure>
      <figure>
        <svg class="chart" id="ch-growth" viewBox="0 0 460 260" role="img" aria-label="Growth against punctures"></svg>
        <figcaption>λ against the number of punctures along the same chains. A pseudo-Anosov map of the closed genus-2 surface has
        λ ≥ 1.722, and the class of each Σ ∖ Q bounds the closed class from above. So λ → 1 shows that the closed class is <em>not</em> pseudo-Anosov.</figcaption>
      </figure>
    </div>
    <p><b>Why +4.</b> With <span class="math">n</span>₁ one-pronged punctures and only 3-pronged singularities, the index formula
    Σ (1 − k/2) = χ(Σ) = 2 − 2g gives <span class="math">n</span>₃ = <span class="math">n</span>₁ + 4g − 4. In genus 2 that is
    <span class="math">n</span>₁ + 4. If all singularities lie in one orbit, the next cut punctures all of them.</p>
    <p><b>Why it never ends here.</b> The point pushes are trivial on the closed surface, so the closed class of this word is
    D<sub>d</sub>⁻¹ D<sub>c₁</sub>⁻¹ D<sub>a</sub>⁻¹: twists along the chain d, c₁, a. That class is reducible (a power of it is a
    twist about the boundary curve of the chain). Each punctured surface Σ ∖ Q still carries a pseudo-Anosov class, as a point push does,
    so the move is offered again and again. The cutting procedure has no step that notices this. A run through the app's own session
    (with the polygon model and μ kept) gives the same punctures and the same λ, to the last digit.</p>
    <div class="tablewrap"><table id="tb-chain"></table></div>
  </section>

  <section>
    <h2>Shortcut against cut</h2>
    <p>At each decision both moves were applied to the same orbit, followed by the autopilot up to the next decision. Both always
    reach the same λ, and the same number of punctures where both succeed. The time includes the autopilot afterwards.</p>
    <div class="figrow">
      <figure>
        <div class="legend" id="leg-time"></div>
        <svg class="chart" id="ch-time" viewBox="0 0 460 270" role="img" aria-label="Time per move against punctures"></svg>
        <figcaption>Seconds per move (log scale) against the number of punctures before it. The cut grows much faster with the
        size of the train track than the shortcut.</figcaption>
      </figure>
      <figure>
        <div class="tablewrap" style="border:0"><table id="tb-pairs"></table></div>
        <figcaption>Summary over all decisions where both moves were tried on the same orbit.</figcaption>
      </figure>
    </div>
  </section>

  <section>
    <h2>Choosing the prong</h2>
    <p>Each prong of the chosen orbit is a candidate for the leaf L. The shortest L that cuts off all puncture boundaries varies a lot
    between prongs. Expanding every alternative prong has so far always given the same outcome as the default (shortest) prong.</p>
    <figure>
      <svg class="chart" id="ch-prongs" viewBox="0 0 640 150" role="img" aria-label="Length of L per prong"></svg>
      <figcaption>Real branches of L needed per prong, one row per orbit at a decision. The marker at 2× the best length is where the
      app stops offering prongs.</figcaption>
    </figure>
  </section>

  <section>
    <h2>Which examples need the move at all</h2>
    <p>Each random word is composed on the once-punctured surface, run on the autopilot, and marked as closed if τ ends with a single cusp
    at the puncture. Only then does the closed-surface move start. The reference rows run each word's twists alone, which is
    the same class on the closed surface.</p>
    <figure>
      <div class="legend" id="leg-census"></div>
      <svg class="chart" id="ch-census" viewBox="0 0 640 250" role="img" aria-label="Outcome on the punctured surface by family"></svg>
      <figcaption>Share of examples per outcome on the punctured surface. “Needs the cut”: pseudo-Anosov with one cusp at the
      puncture, so the closed-surface move follows.</figcaption>
    </figure>
    <div class="tablewrap"><table id="tb-census"></table></div>
  </section>

  <section>
    <h2>Problems found in the app</h2>
    <p>These failures come from the app’s moves (replaying the same path in one process, without the study’s serialization, gives the same error).</p>
    <div class="tablewrap"><table id="tb-fail"></table></div>
  </section>

  <section>
    <h2>Method</h2>
    <ul>
      <li>Headless runs of the TypeScript port at commit <code>4d8d27f</code>, with every suggestion except the closed-surface one applied automatically.</li>
      <li>A decision node is the state where the closed-surface suggestion is next. The options there are a cut or the shortcut at each
      singular orbit. Walks take a fixed policy (default, shortcut first, longest period, random), and all walks share one tree of results.</li>
      <li>Generators: the 8 point pushes along the polygon sides (they reproduce the preset’s P_α, P_β̄, P_γ, P_δ) and the 10 Lickorish
      twists in genus 2; in genus 3, 12 pushes and 8 Lickorish twists (6 handle twists and 2 chain twists, each checked against the boundary word).</li>
      <li>Every expansion is limited to 45 minutes and every walk to 12 moves.</li>
    </ul>
  </section>
</main>
<div id="tip" hidden></div>

<script>
const DATA = ${JSON.stringify(data)};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };
const fmt = (x, d = 0) => x == null ? "–" : Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const tip = document.getElementById("tip");
function showTip(evt, lines) {
  tip.replaceChildren();
  lines.forEach(([label, value], i) => { const row = document.createElement("div"); if (value !== undefined) { const b = document.createElement("b"); b.textContent = value; row.append(b, " " + label); } else row.textContent = label; tip.append(row); });
  tip.hidden = false;
  const x = Math.min(evt.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(evt.clientY + 14, innerHeight - tip.offsetHeight - 8);
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => (tip.hidden = true);
function legend(id, items) { const box = document.getElementById(id); for (const [name, color] of items) { const s = document.createElement("span"); const i = document.createElement("i"); i.style.background = color; s.append(i, name); box.append(s); } }
function table(id, head, rows, numeric = []) {
  const t = document.getElementById(id); const thead = document.createElement("thead"); const tr = document.createElement("tr");
  head.forEach((h, i) => { const th = document.createElement("th"); th.textContent = h; if (numeric.includes(i)) th.className = "num"; tr.append(th); });
  thead.append(tr); const tbody = document.createElement("tbody");
  for (const r of rows) { const row = document.createElement("tr"); r.forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (numeric.includes(i)) td.className = "num"; else if (typeof c === "string" && /[↦→]|^[\\d ,]+$/.test(c)) td.className = "mono"; row.append(td); }); tbody.append(row); }
  t.append(thead, tbody);
}

/** Axes and scales for an x/y chart; returns the scale functions. */
function frame(svg, { x0, x1, y0, y1, ylog = false, xTicks, yTicks, xTitle, yTitle, W = 460, H = 260, L = 48, R = 14, T = 12, B = 40 }) {
  const ly = (v) => (ylog ? Math.log10(v) : v);
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => H - B - ((ly(v) - ly(y0)) / (ly(y1) - ly(y0))) * (H - B - T);
  for (const t of yTicks) { el("line", { x1: L, x2: W - R, y1: Y(t), y2: Y(t), class: "grid" }, svg); el("text", { x: L - 6, y: Y(t) + 4, "text-anchor": "end" }, svg).textContent = t; }
  for (const t of xTicks) el("text", { x: X(t), y: H - B + 16, "text-anchor": "middle" }, svg).textContent = t;
  el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "baseline" }, svg);
  el("text", { x: (L + W - R) / 2, y: H - 6, "text-anchor": "middle", class: "axis-title" }, svg).textContent = xTitle;
  const yt = el("text", { x: 12, y: (T + H - B) / 2, "text-anchor": "middle", class: "axis-title", transform: \`rotate(-90 12 \${(T + H - B) / 2})\` }, svg); yt.textContent = yTitle;
  return { X, Y };
}
function lineSeries(svg, pts, color, { X, Y }, tipFor) {
  el("polyline", { points: pts.map(([x, y]) => X(x) + "," + Y(y)).join(" "), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  for (const p of pts) {
    el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: color, stroke: css("--surface"), "stroke-width": 2 }, svg);
    const hit = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 10, fill: "transparent", tabindex: 0 }, svg);
    hit.addEventListener("pointermove", (e) => showTip(e, tipFor(p))); hit.addEventListener("pointerleave", hideTip);
    hit.addEventListener("focus", (e) => { const r = hit.getBoundingClientRect(); showTip({ clientX: r.right, clientY: r.bottom }, tipFor(p)); }); hit.addEventListener("blur", hideTip);
  }
}

function render() {
  for (const id of ["findings", "leg-chain", "leg-time", "leg-census", "ch-punctures", "ch-growth", "ch-time", "ch-prongs", "ch-census", "tb-chain", "tb-pairs", "tb-fail", "tb-census"]) document.getElementById(id).replaceChildren();
  const st = document.getElementById("status");
  st.textContent = DATA.interim ? \`Interim · \${DATA.interim}\` : \`Final · data of \${new Date(DATA.generated).toLocaleString("en-GB")}\`;

  // Findings
  const P = DATA.pairStats, preset = DATA.chains.filter((c) => c.example.startsWith("preset:Point push with"));
  const longest = preset[0] ?? DATA.chains[0];
  const sameAlt = DATA.prongAlt.filter((p) => p.ok && p.defaultOk).length, sameAltYes = DATA.prongAlt.filter((p) => p.sameAsDefault).length;
  const med = (a) => a.length ? a[Math.floor(a.length / 2)] : null;
  const ratios = DATA.pairs.filter((p) => p.cutOk && p.scOk).map((p) => p.cutMs / Math.max(1, p.scMs)).sort((a, b) => a - b);
  const deep = DATA.pairs.filter((p) => p.cutOk && p.scOk && p.parentPunctures >= 10).map((p) => p.cutMs / Math.max(1, p.scMs)).sort((a, b) => a - b);
  const findings = [
    [\`\${longest.cuts}+ moves\`, \`The start-menu example never finishes: punctures \${longest.punctures.filter((x) => x != null).join(" → ")}, λ falling to \${fmt(longest.growth.filter((x) => x != null).at(-1), 3)}. Its closed class is reducible.\`],
    [\`\${fmt(med(ratios), 1)}× faster\`, \`Median speed-up of the shortcut over the cut, including the autopilot after it (\${fmt(med(deep), 0)}× from 10 punctures on). Same λ in \${P.sameGrowth} of \${P.bothOk} cases.\`],
    [\`\${P.onlyCutOk + P.neither} vs \${P.onlyShortcutOk + P.neither}\`, \`Failures of the shortcut vs the cut at the same orbit (of \${P.pairs}). The shortcut breaks more often, mostly with integrity errors after pulling tight.\`],
    [\`\${sameAltYes} / \${sameAlt}\`, \`Alternative prongs that gave the same result as the default prong, although L needs between \${Math.min(...DATA.prongRows.map((r) => r.min))} and \${Math.max(...DATA.prongRows.map((r) => r.max))} real branches.\`],
  ];
  for (const [big, text] of findings) { const d = document.createElement("div"); d.className = "finding"; const b = document.createElement("div"); b.className = "big"; b.textContent = big; const p = document.createElement("p"); p.textContent = text; d.append(b, p); document.getElementById("findings").append(d); }

  // Chains: punctures per move, λ per punctures
  const two = [preset.find((c) => c.punctures[1] === 2), preset.find((c) => c.punctures[1] === 3)].filter(Boolean);
  const colors = [css("--s1"), css("--s2")];
  const names = two.map((c) => \`first orbit of period \${c.periods[0]}\`);
  legend("leg-chain", names.map((n, i) => [n, colors[i]]));
  const maxCut = Math.max(...two.map((c) => c.punctures.filter((x) => x != null).length - 1), 1);
  const maxP = Math.max(...two.flatMap((c) => c.punctures.filter((x) => x != null)), 1);
  const yTop = Math.ceil(maxP / 10) * 10;
  const f1 = frame(document.getElementById("ch-punctures"), { x0: 0, x1: maxCut, y0: 0, y1: yTop, xTicks: [...Array(maxCut + 1).keys()].filter((k) => k % 2 === 0), yTicks: [0, 10, 20, 30, 40, 50].filter((t) => t <= yTop), xTitle: "closed-surface moves so far", yTitle: "punctures" });
  two.forEach((c, i) => lineSeries(document.getElementById("ch-punctures"), c.punctures.filter((x) => x != null).map((p, k) => [k, p]), colors[i], f1, ([k, p]) => [[names[i]], ["punctures after " + k + " moves", String(p)], ["λ", fmt(c.growth[k], 4)]]));
  const f2 = frame(document.getElementById("ch-growth"), { x0: 0, x1: yTop, y0: 1, y1: 7, ylog: true, xTicks: [0, 10, 20, 30, 40, 50].filter((t) => t <= yTop), yTicks: [1, 1.5, 2, 3, 5, 7], xTitle: "punctures", yTitle: "λ (log scale)" });
  two.forEach((c, i) => lineSeries(document.getElementById("ch-growth"), c.punctures.map((p, k) => [p, c.growth[k]]).filter(([p, g]) => p != null && g != null), colors[i], f2, ([p, g]) => [[names[i]], ["λ", fmt(g, 4)], ["punctures", String(p)], ["log λ · |χ|", fmt(Math.log(g) * (2 + p), 2)]]));
  const ref = el("line", { x1: f2.X(0), x2: f2.X(yTop), y1: f2.Y(1.72208), y2: f2.Y(1.72208), stroke: css("--fg-3"), "stroke-dasharray": "4 3" }, document.getElementById("ch-growth"));
  el("text", { x: f2.X(yTop) - 4, y: f2.Y(1.72208) - 5, "text-anchor": "end" }, document.getElementById("ch-growth")).textContent = "least λ of a pA in closed genus 2";
  const c0 = two[0] ?? longest;
  table("tb-chain", ["move", "punctures before", "λ before", "log λ · |χ|", "strips", "orbit period", "move", "seconds"],
    c0.punctures.slice(0, -1).map((p, k) => [String(k + 1), String(p), fmt(c0.growth[k], 4), fmt(Math.log(c0.growth[k]) * (2 + p), 2), String(c0.strips[k]), String(c0.periods[k]), c0.kinds[k], fmt(c0.secs[k], 1)]), [0, 1, 2, 3, 4, 5, 7]);

  // Time per move: cut vs shortcut
  const svgT = document.getElementById("ch-time");
  const pts = DATA.pairs;
  const maxPP = Math.max(...pts.map((p) => p.parentPunctures)) + 2;
  const fT = frame(svgT, { x0: 0, x1: maxPP, y0: 0.03, y1: 1000, ylog: true, xTicks: [0, 5, 10, 15, 20, 25, 30, 35, 40].filter((t) => t <= maxPP), yTicks: [0.1, 1, 10, 100, 1000], xTitle: "punctures before the move", yTitle: "seconds (log scale)", H: 270 });
  legend("leg-time", [["cut", css("--s1")], ["shortcut", css("--s3")]]);
  for (const p of pts) {
    if (p.cutOk && p.scOk) el("line", { x1: fT.X(p.parentPunctures), x2: fT.X(p.parentPunctures), y1: fT.Y(p.cutMs / 1000), y2: fT.Y(p.scMs / 1000), stroke: css("--grid"), "stroke-width": 2 }, svgT);
  }
  for (const p of pts) for (const [ok, ms, color, name, extra] of [[p.cutOk, p.cutMs, css("--s1"), "cut", p.realBranches ? \`L through \${p.realBranches} branches\` : ""], [p.scOk, p.scMs, css("--s3"), "shortcut", ""]]) {
    if (!ok) continue;
    const c = el("circle", { cx: fT.X(p.parentPunctures), cy: fT.Y(Math.max(0.03, ms / 1000)), r: 4.5, fill: color, stroke: css("--surface"), "stroke-width": 2, tabindex: 0 }, svgT);
    c.addEventListener("pointermove", (e) => showTip(e, [[name], ["s", fmt(ms / 1000, 1)], ["punctures before", String(p.parentPunctures)], ["orbit period", String(p.period)], ...(extra ? [[extra]] : [])])); c.addEventListener("pointerleave", hideTip);
  }
  const q = (a) => a.length ? a : [];
  table("tb-pairs", ["", "cut", "shortcut"], [
    ["decisions tried", String(P.pairs), String(P.pairs)],
    ["move failed", String(P.onlyShortcutOk + P.neither), String(P.onlyCutOk + P.neither)],
    ["median seconds", fmt(P.msCut[2] / 1000, 2), fmt(P.msShortcut[2] / 1000, 2)],
    ["90 % quantile seconds", fmt(P.msCut[4] / 1000, 1), fmt(P.msShortcut[4] / 1000, 1)],
    ["slowest seconds", fmt(P.msCut[5] / 1000, 0), fmt(P.msShortcut[5] / 1000, 0)],
    ["median autopilot moves after", String(P.runMovesCut[2]), String(P.runMovesShortcut[2])],
    ["faster of the two", String(P.bothOk - P.shortcutFaster), String(P.shortcutFaster)],
    ["same λ afterwards", P.sameGrowth + " / " + P.bothOk, ""],
    ["same strip count afterwards", P.sameStrips + " / " + P.bothOk, ""],
  ], [1, 2]);

  // Prongs
  const svgP = document.getElementById("ch-prongs");
  const rows = DATA.prongRows.filter((r) => r.lengths.length > 0).slice(0, 8);
  const H = 40 + rows.length * 32; svgP.setAttribute("viewBox", \`0 0 640 \${H}\`);
  const maxL = Math.max(...rows.flatMap((r) => r.lengths)) * 1.05;
  const xs = (v) => 150 + (v / maxL) * 470;
  for (const t of [0, 25, 50, 75, 100, 125, 150, 200, 300, 400, 500].filter((t) => t <= maxL)) { el("line", { x1: xs(t), x2: xs(t), y1: 10, y2: H - 28, class: "grid" }, svgP); el("text", { x: xs(t), y: H - 12, "text-anchor": "middle" }, svgP).textContent = t; }
  rows.forEach((r, i) => {
    const y = 26 + i * 32;
    el("text", { x: 0, y: y + 4 }, svgP).textContent = \`\${r.example.replace("preset:", "").slice(0, 16)} · \${r.orbit}\`;
    el("line", { x1: xs(2 * r.min), x2: xs(2 * r.min), y1: y - 9, y2: y + 9, stroke: css("--fg-3"), "stroke-dasharray": "3 2" }, svgP);
    for (const L of r.lengths) { const c = el("circle", { cx: xs(L), cy: y, r: 5, fill: L === r.min ? css("--s1") : css("--s-other"), stroke: css("--surface"), "stroke-width": 2, tabindex: 0 }, svgP);
      c.addEventListener("pointermove", (e) => showTip(e, [["L through", L + " real branches"], [L === r.min ? "the default (shortest)" : L < 2 * r.min ? "offered by the app" : "not offered (≥ 2× the shortest)"]])); c.addEventListener("pointerleave", hideTip); }
  });

  // Census
  const svgC = document.getElementById("ch-census");
  const cats = [["cut", "needs the cut (1 cusp)", css("--s1")], ["pA", "pseudo-Anosov, ≥ 2 cusps", css("--s3")], ["red", "reducible", css("--s2")], ["fin", "finite order", css("--s7")], ["other", "error", css("--s-other")]];
  legend("leg-census", cats.map(([, n, c]) => [n, c]));
  const rowsC = DATA.census; const HC = 20 + rowsC.length * 30; svgC.setAttribute("viewBox", \`0 0 640 \${HC}\`);
  const x0 = 250, w = 380;
  rowsC.forEach((r, i) => {
    const total = cats.reduce((t, [k]) => t + r[k], 0); const y = 8 + i * 30; let x = x0;
    el("text", { x: 0, y: y + 14 }, svgC).textContent = \`\${r.label} (\${total})\`;
    for (const [k, name, color] of cats) { if (!r[k]) continue; const wd = (r[k] / total) * w;
      const rect = el("rect", { x: x + 1, y, width: Math.max(1, wd - 2), height: 20, fill: color, rx: 2, tabindex: 0 }, svgC);
      rect.addEventListener("pointermove", (e) => showTip(e, [[r.label], [name, \`\${r[k]} (\${fmt((100 * r[k]) / total)} %)\`]])); rect.addEventListener("pointerleave", hideTip);
      x += wd; }
  });

  table("tb-census", ["family", ...cats.map(([, n]) => n), "total"], rowsC.map((r) => [r.label, ...cats.map(([k]) => String(r[k])), String(cats.reduce((t, [k]) => t + r[k], 0))]), [1, 2, 3, 4, 5, 6]);

  // Failures
  table("tb-fail", ["move", "error", "count"], Object.entries(DATA.failures).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [m, ...rest] = k.split(": "); return [m, rest.join(": "), String(n)]; }), [2]);
}
render();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
</script>
`;
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} kB)`);
