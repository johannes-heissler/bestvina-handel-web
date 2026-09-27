/**
 * The suggestion system (port note 07; the C# `NextSuggestion` / `ApplySuggestion`): at each state, the next thing
 * to do in the priority order of the algorithm, with its options as typed {@link Move}s (the default first), second-
 * level choices on demand ({@link variants}), and an autopilot that applies the defaults of selected kinds.
 *
 * @module
 */
import type { Edge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";
import { applyMove, type FoldRef, foldRef, type Move, type MoveKind, strip } from "./move";
import { needsAbsorbing } from "./moves/absorb-periphery";
import { candidateCenters, invariantSubforests, isPeripheryFriendlyForest } from "./moves/collapse-forest";
import { cutOptions, prongsOfOrbit } from "./moves/cut-closed-surface";
import { hasOneCuspPuncture, polygonSingularities } from "./moves/fill-puncture";
import type { FoldOption } from "./moves/fold";
import {
  inefficiencies,
  inefficiencyAt,
  peripheralInefficiencies,
  removeInefficiencyStep,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { loosePositions } from "./moves/pull-tight";
import { reduce, type ReductionPiece } from "./moves/reduce";
import { finiteOrder, type ReductionCandidate, reductionCandidates } from "./moves/reducibility";
import { valenceOneJunctions, valenceTwoJunctions } from "./moves/valence";
import { EdgePoint } from "./edge-point";
import { perronFrobenius } from "./perron-frobenius";
import { prongs } from "./singular-leaves";
import { trainTrack } from "./train-track";

// ─── Text ────────────────────────────────────────────────────────────────────────────────────

/** Structured text: the UI renders strips and junctions with their colours (instead of the C# rich-text markup). */
export type TextPart = string | { readonly strip: string } | { readonly junction: string };
export type Text = readonly TextPart[];

/** Plain text, for logs and tests. */
export function plainText(text: Text): string {
  return text.map((p) => (typeof p === "string" ? p : "strip" in p ? p.strip : p.junction)).join("");
}

const strips = (names: readonly string[]): TextPart[] =>
  names.flatMap((name, i) => (i === 0 ? [{ strip: name }] : [", ", { strip: name }]));
const names = (edges: Iterable<Edge>) => [...edges].map((e) => e.name);

// ─── Suggestions ─────────────────────────────────────────────────────────────────────────────

/** What the algorithm has found out about the mapping class. */
export type Classification =
  | { readonly kind: "finite order"; readonly order: number }
  | { readonly kind: "reducible"; readonly candidates: readonly ReductionCandidate[] }
  | { readonly kind: "pseudo-Anosov"; readonly growth: number }
  | { readonly kind: "undecided" };

/** One option of a suggestion: a move, how to show it, and (for choices that are rated) its rating. */
export interface MoveOption {
  readonly move: Move;
  readonly label: Text;
  /** Lower is better, e.g. the number of side crossings after a fold, or the period of a singularity. */
  readonly rating?: number;
}

export type SuggestionKind =
  | "collapse invariant subforest"
  | "pull tight"
  | "remove valence-1 junction"
  | "absorb into periphery"
  | "reducible"
  | "remove valence-2 junctions"
  | "fold peripheral inefficiency"
  | "remove inefficiency"
  | "closed surface"
  | "finished";

export interface Suggestion {
  readonly kind: SuggestionKind;
  readonly description: Text;
  /** The options; the first one is the default (what the autopilot applies). Empty when finished. */
  readonly options: readonly MoveOption[];
  /** Whether several options can be selected and applied together ({@link combine}). */
  readonly multiple: boolean;
  /** The result, for a finished algorithm. */
  readonly classification?: Classification;
}

/** The next suggestion, in the priority order of the C# `NextSuggestion`. */
export function nextSuggestion(fs: FibredSurface): Suggestion {
  const forests = invariantSubforests(fs);
  if (forests.length > 0) {
    const union = new Set(forests.flatMap((f) => [...f]));
    const options: MoveOption[] = forests.map((forest) => ({
      move: { kind: "collapse invariant subforest", strips: names(forest) },
      label: ["Collapse ", ...strips(names(forest))],
    }));
    if (forests.length > 1 && isPeripheryFriendlyForest(fs, union))
      options.unshift({
        move: { kind: "collapse invariant subforest", strips: names(union) },
        label: ["Collapse all: ", ...strips(names(union))],
      });
    return {
      kind: "collapse invariant subforest",
      description: ["There are invariant subforests. Collapsing them is a homotopy equivalence."],
      options,
      multiple: false,
    };
  }

  const loose = [...loosePositions(fs).keys()];
  if (loose.length > 0)
    return {
      kind: "pull tight",
      description: ["g is not tight: some images backtrack, or all images at a junction start alike."],
      options: [
        { move: { kind: "pull tight" }, label: ["Tighten all"] },
        ...loose.map((x) => ({
          move: { kind: "pull tight" as const, at: [x.name] },
          label: ["Tighten at ", { strip: x.name }] as Text,
        })),
      ],
      multiple: true,
    };

  const valenceOne = valenceOneJunctions(fs);
  if (valenceOne.length > 0)
    return {
      kind: "remove valence-1 junction",
      description: ["Junctions of valence 1 can be removed together with their strip."],
      options: valenceOne.map((v) => ({
        move: { kind: "remove valence-1 junction", junctions: [v.name] },
        label: ["Remove ", { junction: v.name }],
      })),
      multiple: true,
    };

  if (needsAbsorbing(fs))
    return {
      kind: "absorb into periphery",
      description: [
        "The periphery is not yet maximal and efficient, or g doesn't act on it as an automorphism.",
      ],
      options: [{ move: { kind: "absorb into periphery" }, label: ["Absorb into the periphery"] }],
      multiple: false,
    };

  const order = finiteOrder(fs);
  if (order !== undefined)
    return finished(["g is a graph automorphism of order ", `${order}`, "."], {
      kind: "finite order",
      order,
    });

  if (!fs.ignoreReducible) {
    const candidates = reductionCandidates(fs);
    if (candidates.length > 0)
      return {
        kind: "reducible",
        description: ["The map is reducible: these invariant subgraphs contain essential strips."],
        options: [
          ...candidates.map((c) => ({
            move: { kind: "reduce" as const, preserved: names(c.preserved) },
            label: ["Reduce along ", ...strips(names(c.preserved))] as Text,
          })),
          { move: { kind: "ignore reducibility" }, label: ["Ignore and continue"] },
        ],
        multiple: false,
        classification: { kind: "reducible", candidates },
      };
  }

  const valenceTwo = valenceTwoJunctions(fs);
  if (valenceTwo.length > 0)
    return {
      kind: "remove valence-2 junctions",
      description: ["Junctions of valence 2 can be removed by merging their two strips."],
      options: [
        { move: { kind: "remove valence-2 junctions" }, label: ["Remove all"] },
        ...valenceTwo.map((v) => ({
          move: { kind: "remove valence-2 junctions" as const, junctions: [v.name] },
          label: ["Remove ", { junction: v.name }] as Text,
        })),
      ],
      multiple: true,
    };

  const peripheral = peripheralInefficiencies(fs);
  if (peripheral.length > 0)
    return {
      kind: "fold peripheral inefficiency",
      description: ["Strips at a junction start with the same strip of the pre-periphery."],
      options: peripheral.map((group) => ({
        move: { kind: "fold peripheral inefficiency", strips: group.map((e) => e.name) },
        label: ["Fold ", ...strips(group.map((e) => e.name))],
      })),
      multiple: false,
    };

  const found = inefficiencies(fs);
  if (found.length > 0)
    return {
      kind: "remove inefficiency",
      description: ["g is not efficient: some image contains an illegal turn."],
      options: found.map((p) => {
        const point = p.point.normalized(fs);
        return {
          move: {
            kind: "remove inefficiency",
            at: { strip: point.edge.name, index: point.index },
            steps: "all",
          },
          label: [`Order ${p.order}: `, point.describe(fs)],
          rating: p.order,
        };
      }),
      multiple: false,
    };

  if (fs.isClosed && hasOneCuspPuncture(fs)) {
    const singularities = polygonSingularities(fs); // sorted by period
    return {
      kind: "closed surface",
      description: [
        "The map is efficient, but τ has only one cusp at the artificial puncture. Replace it by the orbit of a singularity q.",
      ],
      options: [
        ...singularities.map((q) => ({
          move: { kind: "cut along a singular leaf" as const, junction: q.junction.name },
          label: [
            "Cut along a leaf from ",
            { junction: q.junction.name },
            ` (period ${q.orbit.length})`,
          ] as Text,
          rating: q.orbit.length,
        })),
        ...singularities.map((q) => ({
          move: { kind: "replace puncture by singularity" as const, junction: q.junction.name },
          label: [
            "Shortcut: fill the puncture at ",
            { junction: q.junction.name },
            ` (period ${q.orbit.length})`,
          ] as Text,
          rating: q.orbit.length,
        })),
      ],
      multiple: false,
    };
  }

  const { growth } = perronFrobenius(fs, { essentialOnly: true });
  return growth > 1 + 1e-9
    ? finished(["g is an efficient train-track map with growth ", growth.toFixed(6), "."], {
        kind: "pseudo-Anosov",
        growth,
      })
    : finished(["No step applies, but the growth is 1."], { kind: "undecided" });
}

function finished(description: Text, classification: Classification): Suggestion {
  return { kind: "finished", description, options: [], multiple: false, classification };
}

/**
 * Combines several selected options of a suggestion that allows it into one move (the C# "tighten selected",
 * "remove selected").
 */
export function combine(moves: readonly Move[]): Move {
  const [first] = moves;
  if (first === undefined) throw new Error("Nothing selected");
  if (moves.length === 1) return first;
  const all = <T>(lists: readonly (readonly T[] | undefined)[]) =>
    lists.some((l) => l === undefined) ? undefined : [...new Set(lists.flatMap((l) => l ?? []))];
  const ofKind = <K extends MoveKind>(kind: K) => {
    if (!moves.every((m) => m.kind === kind)) throw new Error("Only moves of one kind can be combined");
    return moves as readonly Extract<Move, { kind: K }>[];
  };
  switch (first.kind) {
    case "pull tight": {
      const at = all(ofKind("pull tight").map((m) => m.at));
      return at === undefined ? { kind: "pull tight" } : { kind: "pull tight", at };
    }
    case "remove valence-1 junction":
      return { kind: first.kind, junctions: all(ofKind(first.kind).map((m) => m.junctions)) ?? [] };
    case "remove valence-2 junctions": {
      const js = all(ofKind(first.kind).map((m) => m.junctions));
      return js === undefined ? { kind: first.kind } : { kind: first.kind, junctions: js };
    }
    default:
      throw new Error(`Moves of the kind "${first.kind}" can't be combined`);
  }
}

// ─── Second-level choices ────────────────────────────────────────────────────────────────────

/**
 * The concrete choices within a move, computed on demand (some need the move to be tried on a copy): the fold
 * options of an inefficiency step, the centres of a collapse, the strip to remove at a valence-2 junction, the pieces
 * of a reduction, the cuts of a closed surface. Empty if the move has no further choice.
 */
export function variants(fs: FibredSurface, move: Move): MoveOption[] {
  switch (move.kind) {
    case "collapse invariant subforest": {
      const components = fs.graph.components([...move.strips].map((n) => strip(fs, n).edge));
      if (components.length !== 1) return [];
      return candidateCenters(fs, (components[0] as { vertices: Set<Vertex> }).vertices).map((v) => ({
        move: { ...move, centers: [v.name] },
        label: ["Collapse onto ", { junction: v.name }],
      }));
    }
    case "remove valence-2 junctions": {
      if (move.junctions?.length !== 1) return [];
      const v = fs.graph.vertices.find((x) => x.name === move.junctions?.[0]);
      if (v === undefined) return [];
      return fs.graph.star(v).map((s) => ({
        move: { ...move, removed: s.name },
        label: [
          "Remove ",
          { strip: s.name },
          ", keep ",
          { strip: fs.graph.star(v).find((t) => t !== s)?.name ?? "" },
        ],
      }));
    }
    case "fold peripheral inefficiency":
      return foldVariants(fs, move, (copy, choose) =>
        removePeripheralInefficiency(
          copy,
          move.strips.map((n) => strip(copy, n)),
          choose,
        ),
      );
    case "remove inefficiency":
      return foldVariants(fs, { ...move, steps: "one" }, (copy, choose) => {
        const p = inefficiencyAt(copy, new EdgePoint(strip(copy, move.at.strip), move.at.index));
        if (p !== undefined) removeInefficiencyStep(copy, p, choose);
      });
    case "reduce": {
      let pieces: readonly ReductionPiece[] = [];
      const copy = fs.copy();
      copy.onError = () => {};
      reduce(copy, new Set(move.preserved.map((n) => strip(copy, n).edge)), (offered) => {
        pieces = offered;
        return offered[0] as ReductionPiece;
      });
      return pieces.map((piece, i) => ({
        move: { ...move, piece: i },
        label: [
          piece.kind === "complement" ? "The complement: " : "The invariant subgraph: ",
          ...strips(names(piece.edges)),
          ...(piece.period > 1 ? [` (period ${piece.period})`] : []),
        ],
        rating: piece.period,
      }));
    }
    case "cut along a singular leaf": {
      const tt = trainTrack(fs);
      const all = prongs(tt);
      const q = fs.graph.vertices.find((v) => v.name === move.junction);
      if (q === undefined) return [];
      return cutOptions(tt, prongsOfOrbit(tt, q)).map((o) => ({
        move: {
          ...move,
          prong: all.findIndex((p) => p.atSwitch === o.prong.atSwitch && p.above === o.prong.above),
          realBranches: o.realBranches,
        },
        label: ["Cut through ", `${o.realBranches}`, " real branches"],
        rating: o.realBranches,
      }));
    }
    default:
      return [];
  }
}

/** Tries a folding move on a copy to collect its fold options, and turns them into variants of `move`. */
function foldVariants<
  M extends Extract<Move, { kind: "fold peripheral inefficiency" | "remove inefficiency" }>,
>(
  fs: FibredSurface,
  move: M,
  run: (copy: FibredSurface, choose: (options: FoldOption[]) => FoldOption) => void,
): MoveOption[] {
  // The names are read while choosing: the fold itself may rename the kept strip afterwards.
  let options: { ref: FoldRef; sideCrossings: number }[] = [];
  const copy = fs.copy();
  copy.onError = () => {};
  run(copy, (offered) => {
    options = offered.map((o) => ({ ref: foldRef(o), sideCrossings: o.sideCrossings }));
    return offered[0] as FoldOption;
  });
  return options.map(({ ref, sideCrossings }) => ({
    move: { ...move, fold: ref },
    label: ["Keep ", { strip: ref.preferred }, `, fold along c = ${ref.c || "(empty)"}`],
    rating: sideCrossings,
  }));
}

// ─── Autopilot ───────────────────────────────────────────────────────────────────────────────

/** The kinds the autopilot applies by default: everything except the decision how to reduce. */
export const DEFAULT_AUTOMATIC: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>([
  "collapse invariant subforest",
  "pull tight",
  "remove valence-1 junction",
  "absorb into periphery",
  "remove valence-2 junctions",
  "fold peripheral inefficiency",
  "remove inefficiency",
  "closed surface",
]);

export interface AutopilotOptions {
  /** The suggestion kinds whose default is applied without asking; the autopilot stops at any other. */
  readonly automatic?: ReadonlySet<SuggestionKind>;
  readonly maxSteps?: number;
  /** Called after each move with the resulting surface, e.g. to add it to the history (copy it there). */
  readonly onStep?: (move: Move, surface: FibredSurface) => void;
}

export interface AutopilotResult {
  /** The surface after the last move (a different object if a closed-surface move replaced it). */
  readonly surface: FibredSurface;
  readonly moves: readonly Move[];
  /** The suggestion the autopilot stopped at: finished, or a kind it doesn't apply by itself. */
  readonly stoppedAt: Suggestion;
}

/**
 * Applies the default option of each suggestion while its kind is in `automatic` (the C# `BestvinaHandelAlgorithm`,
 * and the semi-automatic mode: e.g. `automatic = {"pull tight", "remove valence-2 junctions"}` skips just those).
 * Checks the integrity after every move.
 *
 * @throws Error if a move leaves the surface inconsistent.
 */
export function autopilot(fs: FibredSurface, options: AutopilotOptions = {}): AutopilotResult {
  const automatic = options.automatic ?? DEFAULT_AUTOMATIC;
  const maxSteps = options.maxSteps ?? 20 * fs.graph.edgeCount + 20;
  const moves: Move[] = [];
  let surface = fs;
  let suggestion = nextSuggestion(surface);
  while (automatic.has(suggestion.kind) && moves.length < maxSteps) {
    const move = (suggestion.options[0] as MoveOption).move;
    surface = applyMove(surface, move);
    moves.push(move);
    const problems = surface.checkIntegrity();
    if (problems.length > 0) throw new Error(`After "${move.kind}":\n${problems.join("\n")}`);
    options.onStep?.(move, surface);
    suggestion = nextSuggestion(surface);
  }
  return { surface, moves, stoppedAt: suggestion };
}
