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

export function applyMove(fs: FibredSurface, move: Move, hooks: MoveHooks = {}): FibredSurface {
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
