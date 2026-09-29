/**
 * The moves of the algorithm as plain data (port note 07): what the user chose, referring to strips and junctions by
 * name, so that a move can be applied to a copy of the surface (the history keeps every state) and stored as the
 * label of an edge of the history graph. This replaces the C# button strings and option casts in `ApplySuggestion`.
 *
 * @module
 */
import { EdgePath } from "../graph/edge-path";
import { nameTable, parseEdgePath } from "../graph/path-parser";
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { EdgePoint } from "./edge-point";
import { about, narrate } from "./narration";
import type { Text, TextPart } from "./suggestions";
import { type MapUpdateMode, renameJunction, renameStrip, updateMap } from "./map-editing";
import type { FibredSurface } from "./fibred-surface";
import { collapseSubforest } from "./moves/collapse-forest";
import { absorbIntoPeriphery } from "./moves/absorb-periphery";
import { cutClosedSurface, cutOptions, prongsOfOrbit } from "./moves/cut-closed-surface";
import { polygonSingularities, replacePunctureBySingularity } from "./moves/fill-puncture";
import type { FoldOption } from "./moves/fold";
import {
  type FoldChoice,
  inefficiencyAt,
  removeInefficiency,
  removeInefficiencyStep,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { pullTight } from "./moves/pull-tight";
import { reduce } from "./moves/reduce";
import { splitJunctions } from "./moves/split-junctions";
import {
  defaultStripToRemove,
  removeValenceOneJunction,
  removeValenceTwoJunction,
  valenceTwoJunctions,
} from "./moves/valence";
import { invariantSubforests } from "./moves/collapse-forest";
import { perronFrobenius } from "./perron-frobenius";
import { prongs } from "./singular-leaves";
import { trainTrack } from "./train-track";

/**
 * A fold choice by name: keep the strip `preferred`, and fold along c, a path in G₀ written as text; for a loop folded
 * completely, first move its junction along `move` (also a path in G₀).
 */
export interface FoldRef {
  readonly preferred: string;
  readonly c: string;
  readonly move?: string;
}

/** A point of a strip by name: the point between the letters `index − 1` and `index` of g(strip). */
export interface PointRef {
  readonly strip: string;
  readonly index: number;
}

/** A move with all its choices. Optional fields fall back to the default choice. */
export type Move =
  | {
      readonly kind: "collapse invariant subforest";
      readonly strips: readonly string[];
      /** Preferred centres (junction names); a component without one uses its default centre. */
      readonly centers?: readonly string[];
    }
  | {
      readonly kind: "pull tight";
      /** Oriented strip names; all loose places if omitted. */ readonly at?: readonly string[];
    }
  | { readonly kind: "remove valence-1 junction"; readonly junctions: readonly string[] }
  | { readonly kind: "absorb into periphery" }
  | {
      readonly kind: "reduce";
      readonly preserved: readonly string[];
      /** Index into the offered pieces. */ readonly piece?: number;
    }
  | { readonly kind: "ignore reducibility" }
  | {
      /** Split the junctions whose gate graphs are disconnected (τ is disconnected there: f is reducible). */
      readonly kind: "split junctions";
      /** Index into the offered pieces. */ readonly piece?: number;
    }
  | {
      readonly kind: "remove valence-2 junctions";
      /** All of them (until an invariant subforest appears) if omitted. */
      readonly junctions?: readonly string[];
      /** For a single junction: the oriented strip to remove (leaving it). */
      readonly removed?: string;
    }
  /**
   * One fold step (the thesis: an inefficiency is removed fold by fold): folds the initial segments of the strip ends
   * `strips`, as the first step of removing the inefficiency at `at`, or, without `at`, as a peripheral fold.
   */
  | {
      readonly kind: "fold";
      readonly strips: readonly string[];
      readonly at?: PointRef;
      readonly fold?: FoldRef;
    }
  | {
      readonly kind: "fold peripheral inefficiency";
      readonly strips: readonly string[];
      readonly fold?: FoldRef;
    }
  | {
      readonly kind: "remove inefficiency";
      readonly at: PointRef;
      /** "one": lower the order by one (the C# "in steps"); "all": remove it completely. */
      readonly steps: "one" | "all";
      /** The fold of the first step; later steps use the default. */
      readonly fold?: FoldRef;
    }
  | {
      readonly kind: "cut along a singular leaf";
      /** A junction with an infinitesimal polygon: the singularity q. */
      readonly junction: string;
      /** Index into `prongs(trainTrack(fs))` and the length of the cut; by default the shortest cut in q's orbit. */
      readonly prong?: number;
      readonly realBranches?: number;
    }
  | { readonly kind: "replace puncture by singularity"; readonly junction: string }
  /** Editing by hand (the map editor): these are moves too, so that a session is its start plus its moves. */
  | { readonly kind: "edit map"; readonly text: string; readonly mode: MapUpdateMode }
  | { readonly kind: "rename strip"; readonly strip: string; readonly name: string }
  | { readonly kind: "rename junction"; readonly junction: string; readonly name: string };

export type MoveKind = Move["kind"];

/**
 * Applies a move. Most moves change `fs` in place and return it; the closed-surface moves return a new fibred
 * surface. Throws if a name doesn't resolve.
 */
/** After a fold step: the inefficiency the fold followed (now of order k − 1), and the strips of its next fold. */
export interface FollowUp {
  readonly point: PointRef;
  readonly strips: readonly string[];
}

/** What a move tells about itself, for suggesting the natural next step. */
export interface MoveHooks {
  readonly followUp?: (followUp: FollowUp) => void;
}

/**
 * Applies a move (in place where possible; some moves return a new surface). It explains itself while it runs (see
 * `narration.ts`): a sentence on what the move does, then either its own steps (folds) or the changes it made.
 */
export function applyMove(fs: FibredSurface, move: Move, hooks: MoveHooks = {}): FibredSurface {
  return about(fs, () => {
    const intro = introduction(fs, move);
    if (intro.length > 0) narrate(intro);
    const before = snapshot(fs);
    const result = applyMoveQuietly(fs, move, hooks);
    if (!NARRATES_ITSELF.has(move.kind))
      about(result, () => {
        for (const line of changes(before, snapshot(result))) narrate(line);
      });
    return result;
  });
}

/**
 * The moves whose steps explain them completely (the folds, pulling tight); the others are also summed up by their
 * changes afterwards.
 */
const NARRATES_ITSELF = new Set<MoveKind>([
  "fold",
  "fold peripheral inefficiency",
  "remove inefficiency",
  "pull tight",
]);

/** What a move does, in one sentence (before it is applied). */
function introduction(fs: FibredSurface, move: Move): Text {
  const list = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { strip: name }]);
  const junctions = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { junction: name }]);
  switch (move.kind) {
    case "collapse invariant subforest":
      return [
        "Collapse the invariant forest ",
        ...list(move.strips),
        ": g maps it into itself, so contracting each of its trees to one junction is a homotopy equivalence. Its strips disappear from all images.",
      ];
    case "pull tight":
      return [
        "Pull g tight",
        ...(move.at ? [" at ", ...list(move.at)] : [" everywhere"]),
        ": cancel each backtracking x x̄ in the images (an isotopy of f, moving junctions along the cancelled pieces), and where all images at a junction start with the same strip, move the junction along it.",
      ];
    case "remove valence-1 junction":
      return [
        "Remove the junction",
        move.junctions.length === 1 ? " " : "s ",
        ...junctions(move.junctions),
        " of valence 1 together with its strip: the strip retracts into its other end (a homotopy equivalence), and it disappears from all images.",
      ];
    case "remove valence-2 junctions":
      return [
        "Remove junctions of valence 2",
        ...(move.junctions ? [" (", ...junctions(move.junctions), ")"] : []),
        ": at each, its two strips become one, and the junction is forgotten (the images are rewritten accordingly).",
      ];
    case "absorb into periphery":
      return [
        "Absorb into the periphery: make the peripheral subgraph maximal and efficient, so that g acts on it as an automorphism (strips that g maps into the periphery are absorbed into it).",
      ];
    case "reduce":
      return [
        "Reduce along the invariant subgraph ",
        ...list(move.preserved),
        `: the boundary of a neighbourhood of it is a reduction system; split along it and continue on piece ${(move.piece ?? 0) + 1} with the first-return map of g.`,
      ];
    case "ignore reducibility":
      return ["Ignore the reducibility found, and continue the algorithm as if the map were irreducible."];
    case "split junctions":
      return [
        `Split the junctions where the gate graph (the gates, joined by the infinitesimal branches of τ) is disconnected, into one junction per component: the boundary of a neighbourhood of τ is a reduction system. Continue on piece ${(move.piece ?? 0) + 1} with the first-return map of g.`,
      ];
    case "cut along a singular leaf":
      return [
        "Cut along a singular leaf from ",
        { junction: move.junction },
        ": the puncture is replaced by the orbit of this singularity, which gives a new train track for the same map on the surface with these punctures instead.",
      ];
    case "replace puncture by singularity":
      return [
        "Shortcut: fill in the puncture and puncture the surface at the orbit of the singularity ",
        { junction: move.junction },
        " instead.",
      ];
    case "edit map":
      return ["Replace g by the map entered."];
    case "rename strip":
      return ["Rename the strip ", { strip: move.strip }, ` to ${move.name}.`];
    case "rename junction":
      return ["Rename the junction ", { junction: move.junction }, ` to ${move.name}.`];
    case "remove inefficiency": {
      const edge = fs.graph.edges.find((e) => e.name === move.at.strip);
      const point = edge && new EdgePoint(edge.forward, move.at.index);
      return point
        ? ["Remove the inefficiency at ", ...point.describeText(fs), " completely, fold by fold:"]
        : ["Remove an inefficiency completely, fold by fold:"];
    }
    default:
      return [];
  }
}

/** The names, images and junctions of a state, to tell what a move changed. */
interface Snapshot {
  readonly g: Map<string, string[]>;
  readonly mu: Map<string, string>;
  readonly junctions: Set<string>;
}

function snapshot(fs: FibredSurface): Snapshot {
  return {
    g: new Map(fs.graph.edges.map((e) => [e.name, fs.g.image(e.forward).letters.map((x) => x.name)])),
    mu: new Map(fs.graph.edges.map((e) => [e.name, String(fs.mu.image(e.forward)) || "·"])),
    junctions: new Set(fs.graph.vertices.map((v) => v.name)),
  };
}

/** What changed between two states: strips and junctions removed and added, and the images that changed. */
function changes(before: Snapshot, after: Snapshot): Text[] {
  const lines: Text[] = [];
  const strips = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { strip: name }]);
  const junctions = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { junction: name }]);
  const removed = [...before.g.keys()].filter((n) => !after.g.has(n));
  const added = [...after.g.keys()].filter((n) => !before.g.has(n));
  if (removed.length > 0) lines.push(["Strips removed: ", ...strips(removed), "."]);
  if (added.length > 0) lines.push(["New strips: ", ...strips(added), "."]);
  const gone = [...before.junctions].filter((n) => !after.junctions.has(n));
  const come = [...after.junctions].filter((n) => !before.junctions.has(n));
  if (gone.length > 0) lines.push(["Junctions removed: ", ...junctions(gone), "."]);
  if (come.length > 0) lines.push(["New junctions: ", ...junctions(come), "."]);
  const path = (letters: readonly string[]): TextPart[] =>
    letters.length === 0 ? ["·"] : letters.flatMap((n, i) => [...(i === 0 ? [] : [" "]), { strip: n }]);
  const changed = [...after.g].filter(
    ([n, image]) => before.g.has(n) && (before.g.get(n) as string[]).join(" ") !== image.join(" "),
  );
  for (const [n, image] of changed.slice(0, 8))
    lines.push([
      "g: ",
      { strip: n },
      " ↦ ",
      ...path(image),
      " (was ",
      ...path(before.g.get(n) as string[]),
      ")",
    ]);
  if (changed.length > 8) lines.push([`… and ${changed.length - 8} more images under g changed.`]);
  const muChanged = [...after.mu].filter(([n, image]) => before.mu.has(n) && before.mu.get(n) !== image);
  for (const [n, image] of muChanged.slice(0, 8))
    lines.push(["μ: ", { strip: n }, ` ↦ ${image} (was ${before.mu.get(n)})`]);
  if (muChanged.length > 8) lines.push([`… and ${muChanged.length - 8} more images under μ changed.`]);
  if (lines.length === 0) lines.push(["The graph and the maps stay the same."]);
  return lines;
}

function applyMoveQuietly(fs: FibredSurface, move: Move, hooks: MoveHooks = {}): FibredSurface {
  const reportFollowUp = (next: ReturnType<typeof removeInefficiencyStep>) => {
    if (next === undefined || next.order === 0) return;
    const point = next.point.normalized(fs);
    hooks.followUp?.({
      point: { strip: point.edge.name, index: point.index },
      strips: next.edgesToFold.map((e) => e.name),
    });
  };
  switch (move.kind) {
    case "collapse invariant subforest": {
      const centers = new Set(move.centers ?? []);
      collapseSubforest(
        fs,
        edges(fs, move.strips),
        (candidates) => candidates.find((v) => centers.has(v.name)) ?? (candidates[0] as Vertex),
      );
      return fs;
    }
    case "pull tight":
      pullTight(fs, move.at === undefined ? undefined : new Set(move.at.map((name) => strip(fs, name))));
      return fs;
    case "remove valence-1 junction":
      for (const name of move.junctions) removeValenceOneJunction(fs, junction(fs, name));
      return fs;
    case "absorb into periphery":
      absorbIntoPeriphery(fs);
      return fs;
    case "reduce":
      reduce(fs, edges(fs, move.preserved), (pieces) => {
        const piece = pieces[move.piece ?? 0];
        if (piece === undefined) throw new Error(`There is no piece ${move.piece}`);
        return piece;
      });
      return fs;
    case "ignore reducibility":
      fs.ignoreReducible = true;
      return fs;
    case "split junctions":
      splitJunctions(fs, (pieces) => {
        const piece = pieces[move.piece ?? 0];
        if (piece === undefined) throw new Error(`There is no piece ${move.piece}`);
        return piece;
      });
      return fs;
    case "remove valence-2 junctions":
      if (move.junctions === undefined) removeAllValenceTwoJunctions(fs);
      else
        for (const name of move.junctions) {
          const v = junction(fs, name);
          const [s0, s1] = fs.graph.star(v) as [OrientedEdge, OrientedEdge];
          removeValenceTwoJunction(
            fs,
            v,
            move.removed === undefined ? defaultStripToRemove(fs, s0, s1) : strip(fs, move.removed),
          );
        }
      return fs;
    case "fold": {
      const choose = foldChoice(fs, move.fold);
      if (move.at === undefined)
        removePeripheralInefficiency(
          fs,
          move.strips.map((name) => strip(fs, name)),
          choose,
        );
      else {
        const p = inefficiencyAt(fs, new EdgePoint(strip(fs, move.at.strip), move.at.index));
        if (p === undefined) throw new Error(`There is no inefficiency at ${move.at.strip}@${move.at.index}`);
        reportFollowUp(removeInefficiencyStep(fs, p, choose));
      }
      return fs;
    }
    case "fold peripheral inefficiency":
      removePeripheralInefficiency(
        fs,
        move.strips.map((name) => strip(fs, name)),
        foldChoice(fs, move.fold),
      );
      return fs;
    case "remove inefficiency": {
      const p = inefficiencyAt(fs, new EdgePoint(strip(fs, move.at.strip), move.at.index));
      if (p === undefined) throw new Error(`There is no inefficiency at ${move.at.strip}@${move.at.index}`);
      const choose = foldChoice(fs, move.fold);
      if (move.steps === "one") reportFollowUp(removeInefficiencyStep(fs, p, choose));
      else {
        let first = true; // the chosen fold applies to the first step only
        removeInefficiency(fs, p, (options) =>
          first ? ((first = false), choose(options)) : (options[0] as FoldOption),
        );
      }
      return fs;
    }
    case "cut along a singular leaf": {
      const tt = trainTrack(fs);
      const option =
        move.prong !== undefined && move.realBranches !== undefined
          ? { prong: prongs(tt)[move.prong], realBranches: move.realBranches }
          : cutOptions(tt, prongsOfOrbit(tt, junction(fs, move.junction)))[0];
      if (option?.prong === undefined)
        throw new Error(`No cut found for the singularity at ${move.junction}`);
      const { surface } = cutClosedSurface(tt, { prong: option.prong, realBranches: option.realBranches });
      return keepFlags(fs, surface);
    }
    case "edit map":
      updateMap(fs, move.text, move.mode);
      return fs;
    case "rename strip":
      renameStrip(fs, strip(fs, move.strip).edge, move.name);
      return fs;
    case "rename junction":
      renameJunction(fs, junction(fs, move.junction), move.name);
      return fs;
    case "replace puncture by singularity": {
      const q = polygonSingularities(fs).find((s) => s.junction.name === move.junction);
      if (q === undefined) throw new Error(`${move.junction} is not a singularity`);
      return keepFlags(fs, replacePunctureBySingularity(fs, q));
    }
  }
}

/** Removes valence-2 junctions one by one, stopping when an invariant subforest appears (as in C#). */
export function removeAllValenceTwoJunctions(fs: FibredSurface): void {
  // The widths only decide which of the two strips is removed; computing them once for the batch is enough.
  const { widths } = perronFrobenius(fs, { essentialOnly: true });
  for (let [v] = valenceTwoJunctions(fs); v !== undefined; [v] = valenceTwoJunctions(fs)) {
    const [s0, s1] = fs.graph.star(v) as [OrientedEdge, OrientedEdge];
    removeValenceTwoJunction(fs, v, defaultStripToRemove(fs, s0, s1, widths));
    if (invariantSubforests(fs).length > 0) return;
  }
}

/** The flags that describe the surface rather than the state carry over to a new fibred surface. */
function keepFlags(from: FibredSurface, to: FibredSurface): FibredSurface {
  to.isClosed = from.isClosed;
  to.legacyNames = from.legacyNames;
  to.onError = from.onError;
  return to;
}

// ─── Names ───────────────────────────────────────────────────────────────────────────────────

/** The oriented strip with this name ("a" or its inverse "A"). */
export function strip(fs: FibredSurface, name: string): OrientedEdge {
  const e = nameTable(fs.graph).edges.get(name);
  if (e === undefined) throw new Error(`There is no strip ${name}`);
  return e;
}

/** The junction with this name. */
export function junction(fs: FibredSurface, name: string): Vertex {
  const v = fs.graph.vertices.find((x) => x.name === name);
  if (v === undefined) throw new Error(`There is no junction ${name}`);
  return v;
}

function edges(fs: FibredSurface, names: readonly string[]): Set<Edge> {
  return new Set(names.map((name) => strip(fs, name).edge));
}

/** A fold option by name (see {@link FoldRef}). */
export function foldRef(option: FoldOption): FoldRef {
  const ref = { preferred: option.preferred.name, c: option.c.toString() };
  return option.move === undefined ? ref : { ...ref, move: option.move.toString() };
}

/** The fold choice that picks the option `ref` (or the default, the first option). */
function foldChoice(fs: FibredSurface, ref: FoldRef | undefined): FoldChoice {
  if (ref === undefined) return (options) => options[0] as FoldOption;
  const path = (text: string) => (text === "" ? EdgePath.EMPTY : parseEdgePath(text, nameTable(fs.spine0)));
  const c = path(ref.c);
  const move = path(ref.move ?? "");
  return (options) => {
    const option = options.find(
      (o) =>
        o.preferred.name === ref.preferred &&
        o.c.key === c.key &&
        (o.move ?? EdgePath.EMPTY).key === move.key,
    );
    if (option === undefined) throw new Error(`The fold (${ref.preferred}, ${ref.c}) is not possible`);
    return option;
  };
}
