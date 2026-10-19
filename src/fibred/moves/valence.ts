/**
 * Removing junctions of valence 1 and 2 (the C# `FibredSurfaceValence1and2Junctions`). Both moves are
 * homotopy equivalences h : G → G′ that collapse one strip; g becomes h ∘ g ∘ h⁻¹, and μ becomes μ ∘ h⁻¹.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { explain, keepingStates, narrate, quietly } from "../narration";
import { perronFrobenius } from "../perron-frobenius";
import type { TextPart } from "../suggestions";
import { lettersText } from "../text-parts";
import { slideAlong } from "./isotopy";

/** The junctions with exactly one strip end. */
export function valenceOneJunctions(fs: FibredSurface): Vertex[] {
  return fs.graph.vertices.filter((v) => fs.graph.valence(v) === 1);
}

/**
 * Removes a junction v of valence 1 together with its strip e (from v to w), i.e. collapses e into w.
 *
 * - g: the letters e and ē are deleted from all images, and junctions mapped to v are mapped to w.
 *   (Images entering v must leave it right away, so they contain ē e, and the result stays continuous.)
 * - μ: unchanged. G′ is a subgraph of G, and h⁻¹ is the inclusion.
 */
export function removeValenceOneJunction(fs: FibredSurface, v: Vertex): void {
  const star = fs.graph.star(v);
  if (star.length !== 1) throw new Error(`The junction ${v} has valence ${star.length}, not 1`);
  const e = star[0] as OrientedEdge;
  const w = e.target;
  slideAlong(fs, v, e, [
    "Isotopy: slide ",
    { junction: v.name },
    " along its strip ",
    { strip: e.name },
    " to ",
    { junction: w.name },
    ".",
  ]);
  narrate(["Retract ", { strip: e.name }, " into ", { junction: w.name }, "."]);
  explain([
    { strip: e.name },
    " and ",
    { strip: e.reversed.name },
    " disappear from all images (they only occur as ",
    { strip: e.reversed.name },
    " ",
    { strip: e.name },
    ").",
  ]);

  fs.g.substituteInImages((edge) => (edge === e.edge ? EdgePath.EMPTY : undefined));
  redirectVertexImages(fs, v, w);
  fs.removeStrip(e.edge);
  fs.removeJunction(v);
}

/** The junctions of valence 2 whose two strip ends don't belong to the same loop. */
export function valenceTwoJunctions(fs: FibredSurface): Vertex[] {
  return fs.graph.vertices.filter((v) => {
    const star = fs.graph.star(v);
    return star.length === 2 && star[0] !== star[1]?.reversed;
  });
}

/**
 * Removes a junction v of valence 2. Of its two strips r and k (oriented away from v), r is removed and
 * k is extended across v: the new k′ runs along r̄ k from the other end u of r.
 *
 * - The homotopy equivalence h collapses r into u (v ↦ u) and maps k to k′.
 * - g: g(k′) = g(r)⁻¹ g(k), then the letters r and r̄ are deleted from all images, and junctions mapped to v
 *   are mapped to u.
 * - μ: μ(k′) = μ(r)⁻¹ μ(k), reduced; all other images stay the same.
 * - The cyclic order: k′ takes the place of r̄ in the star of u, and keeps its place at its other end.
 *
 * @param removed The strip end at v to remove. By default, a strip in the pre-periphery, or otherwise the one
 *   with the larger Perron–Frobenius width (as in C#).
 */
export function removeValenceTwoJunction(fs: FibredSurface, v: Vertex, removed?: OrientedEdge): void {
  const star = fs.graph.star(v);
  const [s0, s1] = star as [OrientedEdge, OrientedEdge];
  if (star.length !== 2) throw new Error(`The junction ${v} has valence ${star.length}, not 2`);
  if (s0 === s1.reversed) throw new Error(`The junction ${v} only has the loop ${s0.edge}`);
  if (removed !== undefined && removed !== s0 && removed !== s1)
    throw new Error(`${removed} is not a strip end at ${v}`);

  const r = removed ?? defaultStripToRemove(fs, s0, s1);
  const k = r === s0 ? s1 : s0;
  const u = r.target;
  slideAlong(fs, v, r, [
    "Isotopy: slide ",
    { junction: v.name },
    " along ",
    { strip: r.name },
    " to ",
    { junction: u.name },
    ", so that ",
    { strip: r.name },
    " crosses no side.",
  ]);
  const merged = fs.g.image(r).inverse.concat(fs.g.image(k)).letters;
  const mergedName = k.edge.name.toLowerCase().startsWith(r.edge.name.toLowerCase()) ? r.edge.name : k.edge.name;
  narrate([
    "Merge ",
    { strip: r.reversed.name },
    " and ",
    { strip: k.name },
    " at ",
    { junction: v.name },
    " into ",
    { strip: mergedName },
    ".",
  ]);
  explain([
    "g(",
    { strip: mergedName },
    ") = g(",
    { strip: r.reversed.name },
    ") g(",
    { strip: k.name },
    ") = ",
    ...lettersText(merged),
    " (not yet cancelled); ",
    { strip: r.name },
    " disappears from all images.",
  ]);

  // New images of k′ = r̄ k, computed from the old maps.
  fs.g.setImage(k, fs.g.image(r).inverse.concat(fs.g.image(k)));
  fs.mu.setImage(k, fs.mu.image(r).inverse.concatReduced(fs.mu.image(k)).path);

  // Move the start of k from v to u, in the place of r̄.
  fs.graph.reattach(k, u, { after: r.reversed });
  if (k.edge.name.toLowerCase().startsWith(r.edge.name.toLowerCase())) k.edge.name = r.edge.name;

  fs.g.substituteInImages((edge) => (edge === r.edge ? EdgePath.EMPTY : undefined));
  redirectVertexImages(fs, v, u);
  fs.removeStrip(r.edge);
  fs.removeJunction(v);
}

/**
 * The C# choice of the strip to remove at a valence-2 junction: a strip in the pre-periphery, otherwise the one
 * with the larger Perron–Frobenius width. Pass `widths` to reuse them when removing several junctions (computing them
 * is the expensive part on large graphs).
 */
export function defaultStripToRemove(
  fs: FibredSurface,
  s0: OrientedEdge,
  s1: OrientedEdge,
  widths: ReadonlyMap<Edge, number> = perronFrobenius(fs, { essentialOnly: true }).widths,
): OrientedEdge {
  const prePeriphery = fs.prePeriphery();
  if (prePeriphery.has(s0.edge)) return s0;
  if (prePeriphery.has(s1.edge)) return s1;
  const width = (e: Edge) => widths.get(e) ?? 0;
  return width(s0.edge) > width(s1.edge) ? s0 : s1;
}

/**
 * A valence-2 line (port note 28): a maximal path of strips e₁ … eₙ (n ≥ 2) whose inner junctions all have valence 2,
 * and whose ends u (where e₁ starts) and w (where eₙ ends) don't (u = w is allowed).
 */
export interface ValenceTwoLine {
  readonly strips: readonly OrientedEdge[];
  /** The inner junctions: the end of each strip but the last. */
  readonly inner: readonly Vertex[];
}

/**
 * The valence-2 lines. Every junction of {@link valenceTwoJunctions} lies on exactly one, unless its component is a
 * circle of valence-2 junctions only (which has no ends, and is left out).
 */
export function valenceTwoLines(fs: FibredSurface): ValenceTwoLine[] {
  const two = new Set(valenceTwoJunctions(fs));
  const seen = new Set<Vertex>();
  const lines: ValenceTwoLine[] = [];
  for (const v of fs.graph.vertices) {
    if (!two.has(v) || seen.has(v)) continue;
    // The strips from v along x up to the end of the line, or undefined if they come back to v.
    const walk = (x: OrientedEdge): OrientedEdge[] | undefined => {
      const path = [x];
      for (let y = x; two.has(y.target); path.push(y)) {
        if (y.target === v) return undefined;
        const [s0, s1] = fs.graph.star(y.target) as [OrientedEdge, OrientedEdge];
        y = s0 === y.reversed ? s1 : s0;
      }
      return path;
    };
    const [a, b] = fs.graph.star(v) as [OrientedEdge, OrientedEdge];
    const forward = walk(a);
    const backward = walk(b);
    if (forward === undefined || backward === undefined) continue;
    const strips = [...backward.map((x) => x.reversed).reverse(), ...forward];
    const inner = strips.slice(0, -1).map((x) => x.target);
    for (const x of inner) seen.add(x);
    lines.push({ strips, inner });
  }
  return lines;
}

/**
 * The strip of a line that its merge keeps by default: the narrowest (by the Perron–Frobenius widths) that isn't in the
 * pre-periphery, or the narrowest of all. This is what removing its junctions one by one with
 * {@link defaultStripToRemove} keeps, in any order (port note 28).
 */
export function defaultStripToKeep(
  fs: FibredSurface,
  line: ValenceTwoLine,
  widths: ReadonlyMap<Edge, number> = perronFrobenius(fs, { essentialOnly: true }).widths,
  prePeriphery: ReadonlySet<Edge> = fs.prePeriphery(),
): Edge {
  const edges = line.strips.map((x) => x.edge);
  const candidates = edges.some((e) => !prePeriphery.has(e))
    ? edges.filter((e) => !prePeriphery.has(e))
    : edges;
  const width = (e: Edge) => widths.get(e) ?? 0;
  return candidates.reduce((best, e) => (width(e) < width(best) ? e : best));
}

/**
 * Merges a valence-2 line e₁ … eₙ from u to w into its strip `kept` = eₘ (port note 28): the homotopy equivalence
 * collapses the other strips (the inner junctions before eₘ go to u, those after it to w) and stretches eₘ over the
 * whole line. This is {@link removeValenceTwoJunction} at each inner junction, from eₘ outwards, always keeping eₘ,
 * narrated as one step (without the slides of the junctions).
 */
export function mergeValenceTwoLine(
  fs: FibredSurface,
  line: ValenceTwoLine,
  kept: Edge = defaultStripToKeep(fs, line),
): void {
  mergeValenceTwoLines(fs, [{ line, kept }], (merged) => {
    const [only] = merged;
    if (only === undefined) return { step: [] };
    const { line, image, name } = only;
    return {
      step: ["Merge the valence-2 line ", ...lineText(line), " into ", { strip: name }, "."],
      note: [
        "g(",
        { strip: name },
        ") = ",
        ...lettersText(image.slice(0, 10)),
        image.length > 10 ? " …" : "",
        " (not yet cancelled).",
      ],
    };
  });
}

/**
 * Merges all valence-2 lines at once, each into its default strip ({@link defaultStripToKeep}), as one narrated step
 * after the note `intro` (used at the end of the closed-surface moves, port note 28).
 */
export function mergeAllValenceTwoLines(fs: FibredSurface, intro: string): void {
  const lines = valenceTwoLines(fs);
  if (lines.length === 0) return;
  const { widths } = perronFrobenius(fs, { essentialOnly: true });
  const prePeriphery = fs.prePeriphery();
  mergeValenceTwoLines(
    fs,
    lines.map((line) => ({ line, kept: defaultStripToKeep(fs, line, widths, prePeriphery) })),
    (merged) => {
      explain([intro]);
      const list = merged.flatMap(({ line, name }, i): TextPart[] => [
        ...(i === 0 ? [] : ["; "]),
        ...lineText(line),
        " into ",
        { strip: name },
      ]);
      // (Many lines are listed in a note, so that the step stays short.)
      return merged.length <= 2
        ? { step: [merged.length === 1 ? "Merge the valence-2 line " : "Merge the valence-2 lines ", ...list, "."] }
        : { step: [`Merge the ${merged.length} valence-2 lines into single strips.`], note: [...list, "."] };
    },
  );
}

/** A line, shortly: "a b c from u to w", or "a b … f (6 strips) from u to w". */
function lineText(line: ValenceTwoLine): TextPart[] {
  const { strips } = line;
  const shown =
    strips.length <= 4
      ? lettersText(strips)
      : [
          ...lettersText(strips.slice(0, 2)),
          " … ",
          ...lettersText(strips.slice(-1)),
          ` (${strips.length} strips)`,
        ];
  return [
    ...shown,
    " from ",
    { junction: (strips[0] as OrientedEdge).source.name },
    " to ",
    { junction: (strips.at(-1) as OrientedEdge).target.name },
  ];
}

/** What {@link mergeValenceTwoLines} tells its narration about each line. */
export interface MergedLine {
  readonly line: ValenceTwoLine;
  /** g of the whole line, before the merge (not yet cancelled). */
  readonly image: readonly OrientedEdge[];
  /** The name of the merged strip. */
  readonly name: string;
}

/**
 * Merges several valence-2 lines (each into its strip `kept`, see {@link mergeValenceTwoLine}) as one narrated step:
 * `describe` gives the text of the step from the merged lines (and a note after it), and a note on where the junction
 * images at inner junctions went is added.
 */
export function mergeValenceTwoLines(
  fs: FibredSurface,
  merges: readonly { readonly line: ValenceTwoLine; readonly kept: Edge }[],
  describe: (merged: readonly MergedLine[]) => { step: readonly TextPart[]; note?: readonly TextPart[] },
): void {
  if (merges.length === 0) return;
  const before = keepingStates() ? fs.copy() : undefined;
  // Where the junctions mapped to an inner junction go: to the end of the line on its side of the kept strip.
  const end = new Map<Vertex, Vertex>();
  for (const { line, kept } of merges) {
    const m = line.strips.findIndex((x) => x.edge === kept);
    if (m < 0) throw new Error(`The strip ${kept} is not on the line`);
    const u = (line.strips[0] as OrientedEdge).source;
    const w = (line.strips.at(-1) as OrientedEdge).target;
    line.inner.forEach((v, i) => end.set(v, i < m ? u : w));
  }
  const moved = fs.graph.vertices.flatMap((x) => {
    const image = fs.g.vertexImage(x);
    const to = end.get(image);
    return to === undefined || end.has(x) ? [] : [{ x, from: image, to }];
  });
  const images = merges.map(
    ({ line }) => line.strips.reduce((path, x) => path.concat(fs.g.image(x)), EdgePath.EMPTY).letters,
  );

  quietly(() => {
    for (const { line, kept } of merges) {
      const m = line.strips.findIndex((x) => x.edge === kept);
      // From eₘ outwards: at each inner junction, the strip end away from eₘ is removed.
      for (let i = m - 1; i >= 0; i--)
        removeValenceTwoJunction(fs, line.inner[i] as Vertex, (line.strips[i] as OrientedEdge).reversed);
      for (let i = m; i < line.inner.length; i++)
        removeValenceTwoJunction(fs, line.inner[i] as Vertex, line.strips[i + 1] as OrientedEdge);
    }
  });

  const merged = merges.map(({ line, kept }, i) => ({ line, image: images[i] ?? [], name: kept.name }));
  const { step, note } = describe(merged);
  narrate(step, { before });
  if (note !== undefined) explain(note);
  if (moved.length > 0)
    explain([
      ...moved.flatMap(({ x, from, to }, i): TextPart[] => [
        i === 0 ? "g(" : ", g(",
        { junction: x.name },
        ") moves from ",
        { junction: from.name },
        " to ",
        { junction: to.name },
      ]),
      ".",
    ]);
}

/** Junctions that g maps to `from` are mapped to `to` instead. */
function redirectVertexImages(fs: FibredSurface, from: Vertex, to: Vertex): void {
  for (const x of fs.graph.vertices)
    if (x !== from && fs.g.vertexImage(x) === from) fs.g.setVertexImage(x, to);
}
