/**
 * Pulling tight (the C# `FibredSurfacePullingTight`): removing the two ways in which g can fail to be tight.
 *
 * - A **backtrack** is a place x x̄ inside an image g(e).
 * - An **extremal junction** is a junction v at which all images start with the same strip d, i.e. g folds the
 *   whole neighbourhood of v into d.
 *
 * Both are removed by a homotopy of g that doesn't change G or its embedding, so μ stays the same.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { sharedPrefixLength } from "../../util/iter";
import type { FibredSurface } from "../fibred-surface";
import { narrate } from "../narration";
import type { TextPart } from "../suggestions";
import { lettersText } from "../text-parts";

/** A backtrack in g(strip): the letters at `index − 1` and `index` are inverse to each other. */
export interface Backtrack {
  /** The strip (forward orientation) whose image contains the backtrack. */
  readonly strip: OrientedEdge;
  /** The index of the second letter of the backtrack in g(strip). */
  readonly index: number;
}

/** All backtracks inside the images of g. */
export function backtracks(fs: FibredSurface): Backtrack[] {
  return fs.graph.edges.flatMap((edge) => {
    const letters = fs.g.image(edge.forward).letters;
    return letters.flatMap((x, i) =>
      i > 0 && letters[i - 1] === x.reversed ? [{ strip: edge.forward, index: i }] : [],
    );
  });
}

/** The junctions at which all images start with the same strip (the C# `GetExtremalVertices`). */
export function extremalJunctions(fs: FibredSurface): Vertex[] {
  return fs.graph.vertices.filter((v) => {
    const star = fs.graph.star(v);
    const first = star[0] === undefined ? undefined : fs.g.derivative(star[0]);
    return first !== undefined && star.every((e) => fs.g.derivative(e) === first);
  });
}

/**
 * The places where g is not tight, grouped by the strip that g "turns back" on: for a backtrack x̄ x that is
 * the letter x after the turn, for an extremal junction the common first letter. This is the grouping of the
 * C# tightening suggestion ("pull tight at one or more edges").
 */
export function loosePositions(
  fs: FibredSurface,
): Map<OrientedEdge, { backtracks: Backtrack[]; extremalJunctions: Vertex[] }> {
  const result = new Map<OrientedEdge, { backtracks: Backtrack[]; extremalJunctions: Vertex[] }>();
  const entry = (x: OrientedEdge) => {
    if (!result.has(x)) result.set(x, { backtracks: [], extremalJunctions: [] });
    return result.get(x) as { backtracks: Backtrack[]; extremalJunctions: Vertex[] };
  };
  for (const b of backtracks(fs)) entry(fs.g.image(b.strip).at(b.index) as OrientedEdge).backtracks.push(b);
  for (const v of extremalJunctions(fs))
    entry(fs.g.derivative(fs.graph.star(v)[0] as OrientedEdge) as OrientedEdge).extremalJunctions.push(v);
  return result;
}

/**
 * Pulls tight completely (`onlyAt` undefined): afterwards no image has backtracking and no junction is
 * extremal. With `onlyAt`, only the loose positions whose turning strip (see {@link loosePositions}) is in
 * `onlyAt` are removed, one pair of letters at a time, as the C# "tighten selected" does.
 */
export function pullTight(fs: FibredSurface, onlyAt?: ReadonlySet<OrientedEdge>): void {
  const all = onlyAt === undefined;
  const selected = (x: OrientedEdge | undefined) => x !== undefined && (all || onlyAt.has(x));
  // Every step shortens the total length of the images, so this bound is never reached.
  const maxSteps = fs.g.totalLength() + fs.graph.vertexCount + 1;
  for (let step = 0; step < maxSteps; step++) {
    const v = extremalJunctions(fs).find((v) =>
      selected(fs.g.derivative(fs.graph.star(v)[0] as OrientedEdge)),
    );
    if (v !== undefined) {
      narrateExtremalJunction(fs, v, all);
      pullTightExtremalJunction(fs, v, all);
      continue;
    }
    const b = backtracks(fs).find((b) => selected(fs.g.image(b.strip).at(b.index)));
    if (b !== undefined) {
      narrateBacktrack(fs, b, all);
      removeBacktrack(fs, b, all);
      continue;
    }
    return;
  }
  throw new Error("Pulling tight did not terminate");
}

/**
 * Removes the common first letters d of all images at the extremal junction v (one letter, or with `all` the
 * longest common prefix), and moves g(v) along them. For a loop at v, letters are removed at both ends.
 */
export function pullTightExtremalJunction(fs: FibredSurface, v: Vertex, all = false): void {
  const star = fs.graph.star(v);
  const images = star.map((e) => fs.g.image(e).letters);
  const k = all
    ? Math.min(...images.map((image) => sharedPrefixLength(images[0] as OrientedEdge[], image)))
    : 1;
  const lastRemoved = (images[0] as OrientedEdge[])[k - 1];
  if (k < 1 || lastRemoved === undefined) throw new Error(`The junction ${v} is not extremal`);
  for (const e of star) fs.g.setImage(e, fs.g.image(e).slice(k)); // reads the current image, so loops lose both ends
  fs.g.setVertexImage(v, lastRemoved.target);
}

/**
 * Moves the image of the junction v along the strip a leaving g(v) (a homotopy of g; μ doesn't change): every image of
 * a strip end at v loses an initial a, or gets ā in front if it doesn't start with a, and g(v) becomes the end of a.
 * This generalizes pulling an extremal junction tight (where all images start with a); at a junction with a single
 * gate it can shorten the images enough to lower λ. For a loop at v both ends change.
 */
export function moveJunctionImage(fs: FibredSurface, v: Vertex, a: OrientedEdge): void {
  if (a.source !== fs.g.vertexImage(v))
    throw new Error(`The strip ${a.name} doesn't leave the image of ${v.name}`);
  for (const e of fs.graph.star(v)) {
    const image = fs.g.image(e); // (read now: for a loop, the second end sees the first change)
    fs.g.setImage(e, image.first === a ? image.slice(1) : EdgePath.of(a.reversed).concat(image));
  }
  fs.g.setVertexImage(v, a.target);
}

/** Removes the backtrack (one pair of letters, or with `all` the maximal backtracking segment around it). */
export function removeBacktrack(fs: FibredSurface, backtrack: Backtrack, all = false): void {
  const letters = fs.g.image(backtrack.strip).letters;
  const i = backtrack.index;
  if (letters[i - 1] !== letters[i]?.reversed)
    throw new Error(`There is no backtrack at ${i} in g(${backtrack.strip})`);
  let s = 1;
  if (all)
    while (i - s - 1 >= 0 && i + s < letters.length && letters[i + s] === letters[i - s - 1]?.reversed) s++;
  fs.g.setImage(
    backtrack.strip,
    fs.g
      .image(backtrack.strip)
      .slice(0, i - s)
      .concat(fs.g.image(backtrack.strip).slice(i + s)),
  );
}

/** "All images at v start with d e: remove it from them (g(v) moves along it)." */
function narrateExtremalJunction(fs: FibredSurface, v: Vertex, all: boolean): void {
  const star = fs.graph.star(v);
  const images = star.map((e) => fs.g.image(e).letters);
  const k = all
    ? Math.min(...images.map((image) => sharedPrefixLength(images[0] as OrientedEdge[], image)))
    : 1;
  const prefix = (images[0] as OrientedEdge[]).slice(0, k);
  narrate([
    "All images at the junction ",
    { junction: v.name },
    " start with ",
    ...lettersText(prefix),
    ": g can be pulled tight there, removing ",
    k === 1 ? "it" : "them",
    " from the images of ",
    ...star.flatMap((e, i): TextPart[] => [...(i === 0 ? [] : [", "]), { strip: e.name }]),
    " (the image of ",
    { junction: v.name },
    " moves along ",
    ...lettersText(prefix),
    ").",
  ]);
}

/** "g(a) = b c | C d: cancel the backtracking c C." */
function narrateBacktrack(fs: FibredSurface, backtrack: Backtrack, all: boolean): void {
  const letters = fs.g.image(backtrack.strip).letters;
  const i = backtrack.index;
  let s = 1;
  if (all)
    while (i - s - 1 >= 0 && i + s < letters.length && letters[i + s] === letters[i - s - 1]?.reversed) s++;
  // Only a few letters around the backtracking, for long images.
  const [from, to] = [Math.max(0, i - s - 3), Math.min(letters.length, i + s + 3)];
  narrate([
    "g(",
    { strip: backtrack.strip.name },
    ") = ",
    ...(from > 0 ? ["… "] : []),
    ...lettersText(letters.slice(from, i)),
    " | ",
    ...lettersText(letters.slice(i, to)),
    ...(to < letters.length ? [" …"] : []),
    " turns back: cancel ",
    ...lettersText(letters.slice(i - s, i + s)),
    ".",
  ]);
}
