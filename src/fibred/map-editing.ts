/**
 * Editing the graph map and the names by hand (the C# `FibredSurfaceMenu.UpdateGraphMap` with its modes, and
 * `Strip.ReplaceWithInverseEdge` / renaming from the last C# commit).
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { invertName, isForwardName } from "../graph/names";
import { parseMap } from "../graph/path-parser";
import type { Edge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";

/**
 * How a typed map h changes g: replace it (g ← h), apply h after g (g ← h ∘ g), or before g (g ← g ∘ h). Strips that
 * the text doesn't mention are mapped to themselves by h.
 */
export type MapUpdateMode = "replace" | "postcompose" | "precompose";

/**
 * Updates g from a map given as text (see `parseMap` for the syntax, including named paths `ρ := …` and
 * conjugation). The new g is not checked here; call `checkIntegrity` to see whether it is a homotopy equivalence
 * that preserves the boundary words.
 *
 * The name of g changes with it: `name` is the name of h (e.g. "D_a"); without one, the new g has no name.
 *
 * @throws ParseError for unreadable text, Error if h is not continuous.
 */
export function updateMap(
  fs: FibredSurface,
  text: string,
  mode: MapUpdateMode = "replace",
  name?: string,
): void {
  const h = CombinatorialMap.fromEdgeImages(fs.graph, fs.graph, parseMap(text, fs.graph).images);
  const result = mode === "replace" ? h : mode === "postcompose" ? h.after(fs.g) : fs.g.after(h);
  for (const v of fs.graph.vertices) fs.g.setVertexImage(v, result.vertexImage(v));
  for (const e of fs.graph.edges) fs.g.setImage(e.forward, result.image(e.forward));
  fs.mapName =
    name === undefined || (mode !== "replace" && fs.mapName === undefined)
      ? undefined
      : mode === "replace"
        ? name
        : mode === "postcompose"
          ? composeMapNames(name, fs.mapName as string)
          : composeMapNames(fs.mapName as string, name);
}

/** The name of the identity (the map of a new fibred surface); composing with it leaves a name unchanged. */
export const IDENTITY_NAME = "id";

/**
 * The name of f ∘ h, from the names of f and h: "D_b ∘ D_a". Names with spaces that are not compositions themselves
 * (e.g. "Anosov map") are put in parentheses.
 */
export function composeMapNames(f: string, h: string): string {
  if (f === IDENTITY_NAME) return h;
  if (h === IDENTITY_NAME) return f;
  const factor = (name: string) => (/\s/.test(name) && !name.includes(" ∘ ") ? `(${name})` : name);
  return `${factor(f)} ∘ ${factor(h)}`;
}

/**
 * Reverses the orientation of the strip `e`: its name now denotes the other direction (so "a" and "A" swap), and
 * every image is rewritten accordingly. Nothing changes geometrically.
 */
export function invertStrip(fs: FibredSurface, e: Edge): void {
  const ownImage = fs.g.image(e.forward);
  const ownMu = fs.mu.image(e.forward);
  fs.graph.invertEdge(e);
  // The old forward orientation is now called backward: substitute it in all images (including e's own).
  fs.g.substituteInImages((x) => (x === e ? EdgePath.of(e.backward) : undefined));
  fs.g.setImage(
    e.forward,
    ownImage.inverse.substitute((x) => (x === e ? EdgePath.of(e.backward) : EdgePath.of(x.forward))),
  );
  fs.mu.setImage(e.forward, ownMu.inverse);
}

/**
 * Renames the strip `e`. A name starting with an uppercase letter means the other direction ("A" for a strip now
 * called a runs the other way), so the strip is inverted and gets the lowercase name.
 *
 * @throws Error if the name contains no letter or another strip already has it.
 */
export function renameStrip(fs: FibredSurface, e: Edge, name: string): void {
  const forwardName = isForwardName(name) ? name : invertName(name);
  if (fs.graph.edges.some((f) => f !== e && f.name.toLowerCase() === forwardName.toLowerCase()))
    throw new Error(`Another strip is already called ${forwardName}`);
  if (!isForwardName(name)) invertStrip(fs, e);
  e.name = forwardName;
}

/** Renames the junction `v`. @throws Error if another junction has that name. */
export function renameJunction(fs: FibredSurface, v: Vertex, name: string): void {
  if (fs.graph.vertices.some((w) => w !== v && w.name === name))
    throw new Error(`Another junction is called ${name}`);
  v.name = name;
}
