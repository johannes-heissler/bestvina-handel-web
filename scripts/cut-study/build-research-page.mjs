// Renders docs/research/endless-cut-chain.md as a self-contained HTML page (Markdown via marked, math via MathJax SVG):
// `node build-research-page.mjs <in.md> <out.html>`.
import { readFileSync, writeFileSync } from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
const markdown = readFileSync(inPath, "utf8");

const html = `<title>The Endless Cut Chain</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
/* Layout: one reading column (~42rem) with a contents list; wide tables scroll inside their own box. */
:root {
  --bg: #f6f7f8; --paper: #ffffff; --ink: #1b1f23; --ink-2: #4b535b; --ink-3: #7c858e; --rule: #dde2e6;
  --accent: #2b5d94; --code-bg: #eef1f4;
  --role-theorem: #2b5d94; --role-computation: #1d7a5a; --role-conjecture: #a35d00; --role-definition: #6a5aa8;
  --f-body: "Source Serif 4", "Georgia", serif;
  --f-head: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121417; --paper: #191c20; --ink: #e8eaed; --ink-2: #b6bdc4; --ink-3: #89929b; --rule: #2d3238;
  --accent: #82b1e8; --code-bg: #23272c;
  --role-theorem: #82b1e8; --role-computation: #5cc49b; --role-conjecture: #e3a04f; --role-definition: #a99ae6;
  color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #121417; --paper: #191c20; --ink: #e8eaed; --ink-2: #b6bdc4; --ink-3: #89929b; --rule: #2d3238;
  --accent: #82b1e8; --code-bg: #23272c;
  --role-theorem: #82b1e8; --role-computation: #5cc49b; --role-conjecture: #e3a04f; --role-definition: #a99ae6;
  color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font: 17px/1.62 var(--f-body); }
.page { max-width: 44rem; margin: 0 auto; padding-block: 2.5rem 5rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
article h1, article h2, article h3 { font-family: var(--f-head); line-height: 1.25; text-wrap: balance; }
article h1 { font-size: 2.1rem; margin: 2.6rem 0 1rem; }
article h1:first-child { margin-top: 0; }
article h2 { font-size: 1.35rem; margin: 2.2rem 0 .7rem; padding-top: .4rem; border-top: 1px solid var(--rule); }
article h3 { font-size: 1.1rem; margin: 1.6rem 0 .5rem; }
article p, article ul, article ol { margin: 0 0 1rem; }
article li { margin: .25rem 0; }
article hr { border: 0; border-top: 1px solid var(--rule); margin: 2.4rem 0; }
article a { color: var(--accent); }
article code { font: .85em var(--f-mono); background: var(--code-bg); padding: .05rem .3rem; border-radius: 3px; }
article em { font-style: italic; }
.tablewrap { overflow-x: auto; margin: 0 0 1.2rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--paper); }
article table { border-collapse: collapse; width: 100%; font-size: .9rem; }
article th, article td { padding: .4rem .7rem; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top; }
article th { font: 600 .78rem/1.3 var(--f-head); color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; }
article td { font-variant-numeric: tabular-nums; }
/* Theorem-like paragraphs: a rule in the colour of their role. */
.role { border-left: 3px solid var(--rule); padding: .1rem 0 .1rem .9rem; margin-left: -1rem; }
.role-theorem { border-color: var(--role-theorem); }
.role-computation { border-color: var(--role-computation); }
.role-conjecture { border-color: var(--role-conjecture); }
.role-definition { border-color: var(--role-definition); }
mjx-container[display="true"] { overflow-x: auto; overflow-y: hidden; padding: .2rem 0; }
nav.toc { font: .9rem/1.5 var(--f-head); background: var(--paper); border: 1px solid var(--rule); border-radius: 4px;
  padding: .9rem 1.1rem; margin: 0 0 2rem; }
nav.toc strong { display: block; font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); margin-bottom: .4rem; }
nav.toc ol { margin: 0; padding-left: 1.1rem; columns: 2 16rem; column-gap: 2rem; }
nav.toc li { margin: .1rem 0; break-inside: avoid; }
nav.toc a { color: var(--ink-2); text-decoration: none; }
nav.toc a:hover { color: var(--accent); text-decoration: underline; }
.legend { font: .82rem/1.5 var(--f-head); color: var(--ink-3); display: flex; flex-wrap: wrap; gap: .3rem 1.2rem; margin: 0 0 1.4rem; }
.legend span::before { content: ""; display: inline-block; width: .7rem; height: .7rem; margin-right: .35rem; vertical-align: -1px; border-radius: 2px; background: var(--c); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#loading { color: var(--ink-3); font: .9rem var(--f-head); }
</style>
<div class="page">
  <nav class="toc" id="toc" hidden><strong>Contents</strong><ol id="toc-list"></ol></nav>
  <div class="legend" id="legend" hidden>
    <span style="--c: var(--role-definition)">definition</span>
    <span style="--c: var(--role-theorem)">theorem, lemma, proposition</span>
    <span style="--c: var(--role-computation)">computation</span>
    <span style="--c: var(--role-conjecture)">conjecture</span>
  </div>
  <article id="doc"><p id="loading">Loading the document…</p></article>
</div>
<script id="source" type="text/markdown">${markdown.replace(/<\/script/gi, "<\\/script")}</script>
<script>
window.MathJax = { tex: { inlineMath: [["\\\\(", "\\\\)"]], displayMath: [["\\\\[", "\\\\]"]], processEscapes: false },
  svg: { fontCache: "global" }, startup: { typeset: false } };
</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"></script>
<script>
(function () {
  const src = document.getElementById("source").textContent;
  // Protect the mathematics from Markdown: $$…$$ and $…$ become placeholders, restored as \\[…\\] and \\(…\\).
  const math = [];
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let text = src.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (_, m) => { math.push("\\\\[" + escape(m) + "\\\\]"); return "MATHPLACEHOLDER" + (math.length - 1) + "X"; });
  text = text.replace(/\\$([^$\\n]+?)\\$/g, (_, m) => { math.push("\\\\(" + escape(m) + "\\\\)"); return "MATHPLACEHOLDER" + (math.length - 1) + "X"; });
  let html = marked.parse(text, { gfm: true });
  html = html.replace(/MATHPLACEHOLDER(\\d+)X/g, (_, i) => math[Number(i)]);
  const doc = document.getElementById("doc");
  doc.innerHTML = html;
  // Tables scroll in their own box.
  doc.querySelectorAll("table").forEach((t) => { const w = document.createElement("div"); w.className = "tablewrap"; t.replaceWith(w); w.appendChild(t); });
  // Roles of theorem-like paragraphs.
  const roles = [[/^(Theorem|Lemma|Proposition|Corollary)/, "theorem"], [/^Computation/, "computation"], [/^Conjecture/, "conjecture"], [/^Definition/, "definition"]];
  doc.querySelectorAll("p").forEach((p) => {
    const first = p.firstElementChild;
    if (!first || first.tagName !== "STRONG" || p.firstChild !== first) return;
    for (const [re, role] of roles) if (re.test(first.textContent)) { p.classList.add("role", "role-" + role); break; }
  });
  // Contents from the headings.
  const list = document.getElementById("toc-list");
  let n = 0;
  doc.querySelectorAll("h1, h2").forEach((h) => {
    const id = "s" + n++;
    h.id = id;
    if (h.tagName === "H2" || /^Part/.test(h.textContent)) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + id;
      a.textContent = h.textContent;
      if (h.tagName === "H1") { li.style.listStyle = "none"; li.style.marginLeft = "-1.1rem"; li.style.fontWeight = "600"; li.style.marginTop = ".4rem"; }
      li.appendChild(a);
      list.appendChild(li);
    }
  });
  document.getElementById("toc").hidden = false;
  document.getElementById("legend").hidden = false;
  // Move the contents and legend below the first section (the title and summary).
  const firstRule = doc.querySelector("hr");
  if (firstRule) { firstRule.after(document.getElementById("toc")); document.getElementById("toc").after(document.getElementById("legend")); }
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([doc]);
  else window.addEventListener("load", () => MathJax.typesetPromise([doc]));
})();
</script>
`;
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} kB)`);
