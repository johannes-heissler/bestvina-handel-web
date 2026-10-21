/**
 * The moves of the algorithm as plain data (port note 07): what the user chose, referring to strips and junctions by
 * name, so that a move can be applied to a copy of the surface (the history keeps every state) and stored as the
 * label of an edge of the history graph. This replaces the C# button strings and option casts in `ApplySuggestion`.
 *
 * @module
 */
import { canonicalName } from "../graph/names";
import { EdgePath } from "../graph/edge-path";
import { nameTable, parseEdgePath } from "../graph/path-parser";
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { EdgePoint } from "./edge-point";
import { about, explain, keepingStates, narrate, narrated, narrating, retell, stateNow } from "./narration";
import type { Text, TextPart } from "./suggestions";
import { type MapUpdateMode, renameJunction, renameStrip, updateMap } from "./map-editing";
import type { FibredSurface } from "./fibred-surface";
import { collapseSubforest } from "./moves/collapse-forest";
import { absorbIntoPeriphery } from "./moves/absorb-periphery";
import { cutClosedSurface, cutOptions, cutOrbit, NoCutFound, prongsOfOrbit } from "./moves/cut-closed-surface";
import type { RemarkingProvider } from "./remarking";
import { polygonSingularities, ratedFillings, replacePunctureBySingularity } from "./moves/fill-puncture";
import type { FoldOption } from "./moves/fold";
import {
  type FoldChoice,
  inefficiencyAt,
  removeInefficiency,
  removeInefficiencyStep,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { tightenMarking } from "./moves/isotopy";
import { moveJunctionImage, pullTight } from "./moves/pull-tight";
import { reduce } from "./moves/reduce";
import { splitJunctions } from "./moves/split-junctions";
import {
  defaultStripToKeep,
  defaultStripToRemove,
  mergeValenceTwoLine,
  removeValenceOneJunction,
  removeValenceTwoJunction,
  valenceTwoJunctions,
  valenceTwoLines,
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
  /** Choose the peripheral subgraph P (strips by name). */
  | { readonly kind: "set peripheral subgraph"; readonly strips: readonly string[] }
  | { readonly kind: "ignore peripheral subgraph" }
  /** Move the image of a junction along a strip leaving it (a shortcut at a junction with a single gate). */
  | { readonly kind: "move junction image"; readonly junction: string; readonly along: string }
  | {
      /** Split the junctions whose gate graphs are disconnected (τ is disconnected there: f is reducible). */
      readonly kind: "split junctions";
      /** Index into the offered pieces. */ readonly piece?: number;
    }
  /** Merge valence-2 lines into single strips (port note 28). */
  | {
      readonly kind: "merge valence-2 lines";
      /** Each line by one of its inner junctions; all lines (until an invariant subforest appears) if omitted. */
      readonly lines?: readonly string[];
      /** For a single line: the strip to keep. */
      readonly kept?: string;
    }
  /** The valence-2 move junction by junction, as suggested before port note 28 (kept for replaying saved sessions). */
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
  | {
      readonly kind: "replace puncture by singularity";
      readonly junction: string;
      /**
       * The strips of the blown-up surface to delete, one per puncture of P, by their letters on its faces, in order
       * (see `fillings`); by default the way with the least growth after pulling tight.
       */
      readonly fill?: readonly string[];
    }
  /** The one puncture is artificial: the surface is closed (port note 24). G, g, μ and G₀ stay the same. */
  | { readonly kind: "mark as closed" }
  /** Editing by hand (the map editor): these are moves too, so that a session is its start plus its moves. */
  | {
      readonly kind: "edit map";
      readonly text: string;
      readonly mode: MapUpdateMode;
      /** The name of the map entered (e.g. "D_a"), composed into the name of g; without one, g loses its name. */
      readonly name?: string;
    }
  /** Rename the mapping class g represents (undefined: no name). */
  | { readonly kind: "rename map"; readonly name?: string }
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
  /** For the closed-surface moves: keeps the original model by placing the new punctures in it (port note 22). */
  readonly remark?: RemarkingProvider;
}

/**
 * Applies a move (in place where possible; some moves return a new surface). It explains itself while it runs (see
 * `narration.ts`): its own steps (folds, isotopies, …), or, for a move without steps of its own, its title as its one
 * step, then notes on the changes it made.
 */
export function applyMove(fs: FibredSurface, move: Move, hooks: MoveHooks = {}): FibredSurface {
  return about(fs, () => {
    const { title, note } = introduction(fs, move);
    const before = stateNow();
    const snapshotBefore = snapshot(fs);
    const run = () => {
      const result = applyMoveQuietly(fs, move, hooks);
      // Moves that contract or split strips can leave a junction whose strips all leave across the same side of G₀;
      // isotope it across (G and g stay the same), so that the embedding can be drawn.
      tightenMarking(result);
      return result;
    };
    if (!narrating()) return run();
    const { result, steps } = narrated(run, { states: keepingStates() });
    // (A move with steps of its own doesn't need its title: the move is shown with its name already.)
    if (title !== undefined && !steps.some((s) => !s.note)) narrate(title, { before });
    if (note !== undefined) explain(note);
    retell(steps);
    if (!NARRATES_ITSELF.has(move.kind)) for (const line of changes(snapshotBefore, snapshot(result))) explain(line);
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
  "cut along a singular leaf",
  "replace puncture by singularity",
]);

/** What a move does: a short title (its one step if it has no steps of its own), and a note on why, if needed. */
function introduction(fs: FibredSurface, move: Move): { title?: Text; note?: Text } {
  const list = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { strip: name }]);
  const junctions = (names: readonly string[]): TextPart[] =>
    names.flatMap((name, i) => [...(i === 0 ? [] : [", "]), { junction: name }]);
  switch (move.kind) {
    case "collapse invariant subforest":
      return { title: ["Collapse the invariant forest ", ...list(move.strips), "."] };
    case "pull tight":
      return { title: ["Pull g tight", ...(move.at ? [" at ", ...list(move.at)] : []), "."] };
    case "remove valence-1 junction":
      return {
        title: [
          move.junctions.length === 1 ? "Remove the junction " : "Remove the junctions ",
          ...junctions(move.junctions),
          " of valence 1.",
        ],
      };
    case "merge valence-2 lines":
      return {
        title: [
          move.lines?.length === 1 ? "Merge a valence-2 line" : "Merge the valence-2 lines",
          ...(move.lines && move.lines.length > 1 ? [" (through ", ...junctions(move.lines), ")"] : []),
          ".",
        ],
      };
    case "remove valence-2 junctions":
      return {
        title: move.junctions
          ? [
              move.junctions.length === 1 ? "Remove the junction " : "Remove the junctions ",
              ...junctions(move.junctions),
              " of valence 2.",
            ]
          : ["Remove the junctions of valence 2."],
      };
    case "absorb into periphery":
      return { title: ["Absorb into the periphery."] };
    case "reduce":
      return {
        title: ["Reduce along ", ...list(move.preserved), "."],
        note: [
          `Split along the boundary of a neighbourhood of it (a reduction system), and continue on piece ${(move.piece ?? 0) + 1} with the first-return map of g.`,
        ],
      };
    case "ignore reducibility":
      return {
        title: ["Ignore the reducibility."],
        note: ["The algorithm continues as if g were irreducible: convergence and correctness are not guaranteed."],
      };
    case "set peripheral subgraph":
      return {
        title: [
          "Take ",
          ...(move.strips.length === 0 ? ["the empty subgraph"] : list(move.strips)),
          " as the peripheral subgraph P.",
        ],
      };
    case "move junction image":
      return {
        title: ["Move g(", { junction: move.junction }, ") along ", { strip: move.along }, "."],
        note: [
          "Images at ",
          { junction: move.junction },
          " that start with ",
          { strip: move.along },
          " lose it; the others get ",
          { strip: strip(fs, move.along).reversed.name },
          " in front.",
        ],
      };
    case "ignore peripheral subgraph":
      return {
        title: ["Keep the peripheral subgraph as it is."],
        note: ["It doesn't fulfil its definition: convergence and correctness are not guaranteed."],
      };
    case "split junctions":
      return {
        title: ["Split the junctions whose gate graphs are disconnected."],
        note: [
          `One junction per component (the boundary of a neighbourhood of τ is a reduction system); continue on piece ${(move.piece ?? 0) + 1} with the first-return map of g.`,
        ],
      };
    case "cut along a singular leaf":
      return {
        title: ["Cut along a leaf from the singularity at ", { junction: move.junction }, "."],
        note: [
          "τ has one cusp at each artificial puncture, so they can't be filled in: the surface is punctured at this singularity (and its orbit under f) instead.",
        ],
      };
    case "replace puncture by singularity":
      return {
        title: ["Puncture the surface at the singularity at ", { junction: move.junction }, " instead of p."],
      };
    case "mark as closed":
      return {
        title: ["Mark the surface as closed."],
        note: [
          "G, g, μ and G₀ stay the same; the polygon becomes compact. τ has one cusp at the puncture, so it is replaced by a singularity next.",
        ],
      };
    case "edit map":
      return { title: ["Replace g by the map entered."] };
    case "rename map":
      return { title: [move.name === undefined ? "Remove the name of g." : `Name g ${move.name}.`] };
    case "rename strip":
      return { title: ["Rename the strip ", { strip: move.strip }, ` to ${move.name}.`] };
    case "rename junction":
      return { title: ["Rename the junction ", { junction: move.junction }, ` to ${move.name}.`] };
    default:
      return {};
  }
}

/** The names, images and junctions of a state, to tell what a move changed. */
interface Snapshot {
  readonly g: Map<string, string[]>;
  readonly mu: Map<string, string>;
  readonly junctions: Set<string>;
  readonly peripheral: string[];
}

function snapshot(fs: FibredSurface): Snapshot {
  return {
    g: new Map(fs.graph.edges.map((e) => [e.name, fs.g.image(e.forward).letters.map((x) => x.name)])),
    mu: new Map(fs.graph.edges.map((e) => [e.name, String(fs.mu.image(e.forward)) || "·"])),
    junctions: new Set(fs.graph.vertices.map((v) => v.name)),
    peripheral: [...fs.peripheral].map((e) => e.name).sort(),
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
  const gone = [...before.junctions].filter((n) => !after.junctions.has(n));
  const come = [...after.junctions].filter((n) => !before.junctions.has(n));
  /** "strips a, b; junction v" */
  const both = (stripNames: readonly string[], junctionNames: readonly string[]): TextPart[] => [
    ...(stripNames.length === 0 ? [] : [stripNames.length === 1 ? "strip " : "strips ", ...strips(stripNames)]),
    ...(stripNames.length > 0 && junctionNames.length > 0 ? ["; "] : []),
    ...(junctionNames.length === 0
      ? []
      : [junctionNames.length === 1 ? "junction " : "junctions ", ...junctions(junctionNames)]),
  ];
  if (removed.length + gone.length > 0) lines.push(["Removed: ", ...both(removed, gone), "."]);
  if (added.length + come.length > 0) lines.push(["New: ", ...both(added, come), "."]);
  /** A path, its first letters for long ones. */
  const path = (letters: readonly string[]): TextPart[] =>
    letters.length === 0
      ? ["·"]
      : [
          ...letters.slice(0, 10).flatMap((n, i) => [...(i === 0 ? [] : [" "]), { strip: n }]),
          ...(letters.length > 10 ? [" …"] : []),
        ];
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
  if (before.peripheral.join(" ") !== after.peripheral.join(" "))
    lines.push([
      "Peripheral subgraph P: ",
      ...(after.peripheral.length === 0 ? ["∅"] : strips(after.peripheral)),
      " (was ",
      ...(before.peripheral.length === 0 ? ["∅"] : strips(before.peripheral)),
      ")",
    ]);
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
    case "set peripheral subgraph":
      fs.peripheral.clear();
      for (const e of edges(fs, move.strips)) fs.peripheral.add(e);
      return fs;
    case "ignore peripheral subgraph":
      fs.ignorePeriphery = true;
      return fs;
    case "move junction image":
      moveJunctionImage(fs, junction(fs, move.junction), strip(fs, move.along));
      return fs;
    case "split junctions":
      splitJunctions(fs, (pieces) => {
        const piece = pieces[move.piece ?? 0];
        if (piece === undefined) throw new Error(`There is no piece ${move.piece}`);
        return piece;
      });
      return fs;
    case "merge valence-2 lines":
      if (move.lines === undefined) mergeLinesOneByOne(fs);
      else
        for (const name of move.lines) {
          const v = junction(fs, name);
          const line = valenceTwoLines(fs).find((l) => l.inner.includes(v));
          if (line === undefined) throw new Error(`The junction ${name} is on no valence-2 line`);
          mergeValenceTwoLine(fs, line, move.kept === undefined ? undefined : strip(fs, move.kept).edge);
        }
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
        throw new NoCutFound(`No cut found for the singularity at ${move.junction}`);
      const remarking = hooks.remark?.(fs, tt, cutOrbit(tt, option.prong));
      const { surface } = cutClosedSurface(
        tt,
        { prong: option.prong, realBranches: option.realBranches },
        remarking,
      );
      return keepFlags(fs, surface);
    }
    case "edit map":
      updateMap(fs, move.text, move.mode, move.name);
      return fs;
    case "mark as closed":
      fs.isClosed = true;
      return fs;
    case "rename map":
      fs.mapName = move.name;
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
      const tt = trainTrack(fs);
      const fill = move.fill ?? ratedFillings(fs, q, (t) => hooks.remark?.(fs, t, q.orbit), tt)[0]?.letters;
      const remarking = hooks.remark?.(fs, tt, q.orbit);
      return keepFlags(fs, replacePunctureBySingularity(fs, q, remarking, tt, fill));
    }
  }
}

/** Merges the valence-2 lines one by one, stopping when an invariant subforest appears (as C# does per junction). */
export function mergeLinesOneByOne(fs: FibredSurface): void {
  // The widths only decide which strip is kept; the kept strips keep their widths, so computing them once is enough.
  const { widths } = perronFrobenius(fs, { essentialOnly: true });
  const prePeriphery = fs.prePeriphery();
  for (let [line] = valenceTwoLines(fs); line !== undefined; [line] = valenceTwoLines(fs)) {
    mergeValenceTwoLine(fs, line, defaultStripToKeep(fs, line, widths, prePeriphery));
    if (invariantSubforests(fs).length > 0) return;
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
  to.mapName = from.mapName;
  to.isClosed = from.isClosed;
  to.legacyNames = from.legacyNames;
  to.legacyPeripheralNames = from.legacyPeripheralNames;
  to.legacyDefaultNames = from.legacyDefaultNames;
  to.onError = from.onError;
  return to;
}

// ─── Names ───────────────────────────────────────────────────────────────────────────────────

/** The oriented strip with this name ("a" or its inverse "A"). */
export function strip(fs: FibredSurface, name: string): OrientedEdge {
  const e = nameTable(fs.graph).edges.get(canonicalName(name));
  if (e === undefined) throw new Error(`There is no strip ${name}`);
  return e;
}

/** The junction with this name. */
export function junction(fs: FibredSurface, name: string): Vertex {
  const v = fs.graph.vertices.find((x) => canonicalName(x.name) === canonicalName(name));
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
