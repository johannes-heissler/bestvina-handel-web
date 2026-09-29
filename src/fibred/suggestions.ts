/**
 * The suggestion system (port note 07; the C# `NextSuggestion` / `ApplySuggestion`): at each state, the next thing
 * to do in the priority order of the algorithm, with its options as typed {@link Move}s (the default first), second-
 * level choices on demand ({@link variants}), and an autopilot that applies the defaults of selected kinds.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";
import { applyMove, type FollowUp, type FoldRef, foldRef, type Move, type MoveKind, strip } from "./move";
import { needsAbsorbing } from "./moves/absorb-periphery";
import { candidateCenters, invariantSubforests, isPeripheryFriendlyForest } from "./moves/collapse-forest";
import { cutOptions, cutTooFine, preimageShrinking, prongsOfOrbit } from "./moves/cut-closed-surface";
import { hasOneCuspPuncture, polygonSingularities } from "./moves/fill-puncture";
import type { FoldOption } from "./moves/fold";
import {
  type FoldCandidate,
  foldCandidates,
  inefficiencyAt,
  removeInefficiencyStep,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { loosePositions } from "./moves/pull-tight";
import { reduce, type ReductionPiece } from "./moves/reduce";
import { disconnectedJunctions, type SplitPiece, splitJunctions } from "./moves/split-junctions";
import { finiteOrder, type ReductionCandidate, reductionCandidates } from "./moves/reducibility";
import { valenceOneJunctions, valenceTwoJunctions } from "./moves/valence";
import { EdgePoint } from "./edge-point";
import { narrated, quietly } from "./narration";
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
  | {
      readonly kind: "reducible";
      readonly candidates: readonly ReductionCandidate[];
      /** The reduction system as words in G₀, when it is known (e.g. from a disconnected train track). */
      readonly curves?: readonly string[];
    }
  | { readonly kind: "pseudo-Anosov"; readonly growth: number }
  | { readonly kind: "undecided" };

/** One option of a suggestion: a move, how to show it, and (for choices that are rated) its rating. */
export interface MoveOption {
  readonly move: Move;
  readonly label: Text;
  /** Lower is better, e.g. the number of side crossings after a fold, or the period of a singularity. */
  readonly rating?: number;
  /** The rating as shown, e.g. "3 side crossings" (otherwise the number alone). */
  readonly ratingText?: string;
  /** Possible, but not the step of the algorithm now (shown greyed out). */
  readonly discouraged?: boolean;
  /** More about the option, shown under it (e.g. the inefficiency points behind a fold). */
  readonly details?: Text;
}

export type SuggestionKind =
  | "collapse invariant subforest"
  | "pull tight"
  | "remove valence-1 junction"
  | "absorb into periphery"
  | "reducible"
  | "remove valence-2 junctions"
  | "fold"
  | "closed surface"
  | "disconnected train track"
  | "finished";

export interface Suggestion {
  readonly kind: SuggestionKind;
  readonly description: Text;
  /**
   * The options; the first one is the default (what the autopilot applies). Empty when finished, except for moves that
   * go beyond the result (the closed-surface moves when τ has a single cusp at the only puncture).
   */
  readonly options: readonly MoveOption[];
  /** Whether several options can be selected and applied together ({@link combine}). */
  readonly multiple: boolean;
  /** The result, for a finished algorithm. */
  readonly classification?: Classification;
  /**
   * What the autopilot does instead of the first option, if that differs: for folds, it removes the whole first
   * inefficiency at once (fast), while the options are single fold steps (visible).
   */
  readonly autopilotMove?: Move;
}

/** What is known from the previous step. */
export interface SuggestionContext {
  /** After a fold step: the inefficiency it followed and the strips of its next fold (see `MoveHooks.followUp`). */
  readonly followUp?: FollowUp | undefined;
}

/**
 * The next suggestion, in the priority order of the C# `NextSuggestion`. Whenever some gate graph is disconnected, the
 * suggestion also offers splitting the junctions there, greyed out: the algorithm does that only at the end.
 */
export function nextSuggestion(fs: FibredSurface, context: SuggestionContext = {}): Suggestion {
  const suggestion = nextStep(fs, context);
  if (suggestion.kind === "finished" || suggestion.kind === "disconnected train track" || fs.ignoreReducible)
    return suggestion;
  const disconnected = disconnectedJunctions(fs);
  if (disconnected.size === 0) return suggestion;
  return {
    ...suggestion,
    options: [
      ...suggestion.options,
      {
        move: { kind: "split junctions" },
        label: [
          "Split ",
          ...junctionList([...disconnected.keys()]),
          " along the components of τ (f is reducible; the algorithm does this only at the end)",
        ],
        discouraged: true,
      },
    ],
  };
}

function nextStep(fs: FibredSurface, context: SuggestionContext): Suggestion {
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
            label: [
              "Reduce along ",
              ...strips(names(c.preserved)),
              ...(c.forest ? [" (an invariant forest with the components of the periphery it touches)"] : []),
            ] as Text,
          })),
          { move: { kind: "ignore reducibility" }, label: ["Ignore and continue"] },
        ],
        multiple: false,
        classification: { kind: "reducible", candidates },
      };
  }

  // While an inefficiency of higher order is being removed fold by fold, its next fold needs the junctions of valence
  // 2 that the previous fold created (the subdivision points): removing them would undo the fold, and the same fold
  // would be suggested again and again. So they wait until the inefficiency is gone.
  const followUp = context.followUp;
  const pending =
    followUp !== undefined &&
    foldCandidates(fs).some(
      (c) =>
        c.places.includes(`${followUp.point.strip}@${followUp.point.index}`) ||
        sameNames(
          c.edgesToFold.map((e) => e.name),
          followUp.strips,
        ),
    );
  const valenceTwo = pending ? [] : valenceTwoJunctions(fs);
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

  const folds = foldCandidates(fs);
  // The natural next step after a fold: the next fold of the inefficiency it followed, first and marked.
  // Matched by its place in the images, or (after pulling tight, which changes the images) by the strips to fold.
  const continues = (c: FoldCandidate) =>
    followUp !== undefined &&
    (c.places.includes(`${followUp.point.strip}@${followUp.point.index}`) ||
      sameNames(
        c.edgesToFold.map((e) => e.name),
        followUp.strips,
      ));
  const next = folds.findIndex(continues);
  if (next > 0) folds.unshift(...folds.splice(next, 1));
  if (folds.length > 0)
    return {
      kind: "fold",
      description: [
        "g is not efficient. Fold the initial segments of strips with the same Dg, one step at a time (removing an inefficiency (α, β) of order k starts by folding Dgᵏ⁻¹(α) and Dgᵏ⁻¹(β)).",
      ],
      ...(folds[0]?.representative && {
        autopilotMove: {
          kind: "remove inefficiency" as const,
          at: {
            strip: folds[0].representative.point.normalized(fs).edge.name,
            index: folds[0].representative.point.normalized(fs).index,
          },
          steps: "all" as const,
        },
      }),
      options: folds.map((c) => {
        const at = c.representative?.point.normalized(fs);
        return {
          move: {
            kind: "fold" as const,
            strips: c.edgesToFold.map((e) => e.name),
            ...(at && { at: { strip: at.edge.name, index: at.index } }),
          },
          label: [...(continues(c) ? ["Next fold of the last inefficiency: "] : []), ...foldLabel(fs, c)],
          ...(c.order !== undefined && { rating: c.order }),
          ...(c.places.length > 0 && { details: placesText(fs, c.places) }),
        };
      }),
      multiple: false,
    };

  const oneCusp = hasOneCuspPuncture(fs);
  if (fs.isClosed && oneCusp)
    return {
      kind: "closed surface",
      description: [
        "The map is efficient, but τ has only one cusp at the artificial puncture. Replace it by the orbit of a singularity q.",
      ],
      options: closedSurfaceOptions(fs),
      multiple: false,
    };

  if (!fs.ignoreReducible) {
    const disconnected = disconnectedJunctions(fs);
    if (disconnected.size > 0) return disconnectedTrainTrack(fs, [...disconnected.keys()]);
  }

  const { growth } = perronFrobenius(fs, { essentialOnly: true });
  if (growth <= 1 + 1e-9) return finished(["No step applies, but the growth is 1."], { kind: "undecided" });
  const result = finished(
    [
      "f is pseudo-Anosov: g is an efficient train-track map with efficient maximal periphery and growth λ = ",
      growth.toFixed(6),
      ", and τ is connected at every junction.",
    ],
    { kind: "pseudo-Anosov", growth },
  );
  // With a single cusp at the only puncture, the puncture might be one that the surface doesn't really have: offer the
  // moves of the closed-surface case anyway, to see what the mapping class would be on the closed surface.
  if (!oneCusp) return result;
  return {
    ...result,
    description: [
      ...result.description,
      " τ has only one cusp at the puncture: if the surface is meant to be closed, fill it in (cut along a singular leaf) and continue on the closed surface.",
    ],
    options: closedSurfaceOptions(fs),
  };
}

/**
 * The moves of the closed-surface case: cut along a leaf from a singularity, or the shortcut, one option per orbit of
 * singularities, by period. Cuts that the floating-point cut can't resolve are shown greyed out.
 */
function closedSurfaceOptions(fs: FibredSurface): MoveOption[] {
  const tt = trainTrack(fs);
  const seen = new Set<Vertex>();
  // (sorted by period) One per orbit.
  const singularities = polygonSingularities(fs, tt).filter((q) => {
    if (seen.has(q.junction)) return false;
    for (const v of q.orbit) seen.add(v);
    return true;
  });
  const orbitText = (orbit: readonly Vertex[]): Text =>
    orbit.length === 1
      ? [" (fixed)"]
      : [
          " (orbit ",
          ...orbit.flatMap((v, i): TextPart[] =>
            i === 0 ? [{ junction: v.name }] : [", ", { junction: v.name }],
          ),
          "; period " + orbit.length + ")",
        ];
  return [
    ...singularities.map((q) => {
      const tooFine = cutTooFine(tt, q.junction);
      return {
        move: { kind: "cut along a singular leaf" as const, junction: q.junction.name },
        label: [
          "Cut along a leaf from ",
          { junction: q.junction.name },
          ...orbitText(q.orbit),
          ...(tooFine
            ? [
                ": not possible yet, its preimages would be " +
                  preimageShrinking(tt, q.junction).toExponential(0) +
                  " times shorter",
              ]
            : []),
        ] as Text,
        rating: q.orbit.length,
        ...(tooFine && { discouraged: true }),
      };
    }),
    ...singularities.map((q) => ({
      move: { kind: "replace puncture by singularity" as const, junction: q.junction.name },
      label: [
        "Shortcut: fill the puncture at ",
        { junction: q.junction.name },
        ...orbitText(q.orbit),
      ] as Text,
      rating: q.orbit.length,
    })),
  ];
}

/**
 * "Fold a and the initial segments of b, c at v: order 2, 3 places" (the C# wording: fully folded strips, then the
 * ones folded partially, based at the junction), or "peripheral: Dg = p ∈ pre-P".
 */
function foldLabel(fs: FibredSurface, c: FoldCandidate): Text {
  const full = c.edgesToFold.filter((e) => fs.g.image(e).length === c.initialSegment).map((e) => e.name);
  const partial = c.edgesToFold.filter((e) => fs.g.image(e).length > c.initialSegment).map((e) => e.name);
  const junctionName = (c.edgesToFold[0] as OrientedEdge).source.name;
  const what: TextPart[] = [
    "Fold ",
    ...strips(full),
    ...(full.length > 0 && partial.length > 0 ? [" and "] : []),
    ...(partial.length > 0 ? ["initial segments of ", ...strips(partial)] : []),
    " at ",
    { junction: junctionName },
  ];
  const d = fs.g.derivative(c.edgesToFold[0] as OrientedEdge);
  const why: TextPart[] =
    c.order === undefined
      ? [": peripheral, Dg = ", ...(d ? [{ strip: d.name }] : []), " is in the pre-periphery"]
      : [
          `: order ${c.order}, ${c.count} ${c.count === 1 ? "place" : "places"}`,
          ...(c.peripheral ? ["; peripheral"] : []),
        ];
  return [...what, ...why];
}

const junctionList = (vs: readonly Vertex[]): TextPart[] =>
  vs.flatMap((v, i) => (i === 0 ? [{ junction: v.name }] : [", ", { junction: v.name }]));

/**
 * The end of the algorithm with a disconnected train track: g is efficient, but at some junctions the gates are not
 * all joined by infinitesimal branches, so f is reducible. The options are the pieces after splitting, each with the
 * growth of g there (its component of τ is an invariant filling train track, so g is pseudo-Anosov there if λ > 1).
 */
function disconnectedTrainTrack(fs: FibredSurface, junctions: readonly Vertex[]): Suggestion {
  const { pieces, curves } = splitPieces(fs);
  const growthOf = (i: number): number | undefined => {
    const copy = fs.copy();
    copy.onError = () => {};
    try {
      splitJunctions(copy, (offered) => offered[i] as SplitPiece);
      return perronFrobenius(copy, { essentialOnly: true }).growth;
    } catch {
      return undefined;
    }
  };
  return {
    kind: "disconnected train track",
    description: [
      "g is an efficient train-track map, but at ",
      ...junctionList(junctions),
      " the gates are not all joined by infinitesimal branches: τ is disconnected there, so f is reducible. The boundary of a neighbourhood of τ is a reduction system",
      ...(curves.length > 0 ? [": ", curves.join(", ")] : []),
      ". Split the junctions and continue on one piece; each component of τ is an invariant filling train track there.",
    ],
    options: [
      ...pieces.map((piece, i) => {
        const growth = growthOf(i);
        return {
          move: { kind: "split junctions" as const, piece: i },
          label: [
            "Continue on ",
            ...strips(names(piece.edges)),
            ...(piece.period > 1 ? [` (period ${piece.period})`] : []),
            ...(growth === undefined
              ? []
              : [growth > 1 + 1e-9 ? `: pseudo-Anosov, λ = ${growth.toFixed(6)}` : ": growth 1"]),
          ] as Text,
          rating: piece.period,
        };
      }),
      { move: { kind: "ignore reducibility" }, label: ["Ignore and finish"] },
    ],
    multiple: false,
    classification: { kind: "reducible", candidates: [], curves },
  };
}

/** The pieces offered after splitting, and the new reduction curves (as words in G₀), tried on a copy. */
function splitPieces(fs: FibredSurface): { pieces: readonly SplitPiece[]; curves: string[] } {
  let pieces: readonly SplitPiece[] = [];
  const copy = fs.copy();
  copy.onError = () => {};
  const before = new Set(copy.reductionCurves.map(String));
  try {
    splitJunctions(copy, (offered) => {
      pieces = offered;
      return offered[0] as SplitPiece;
    });
  } catch {
    return { pieces: [], curves: [] };
  }
  return { pieces, curves: copy.reductionCurves.map(String).filter((c) => !before.has(c)) };
}

/**
 * The inefficiency points behind a fold ("strip@index"), as the images with the points marked by "|": all points
 * inside one image g(x) together, those at junctions of valence 2 by the path through the junction.
 */
function placesText(fs: FibredSurface, places: readonly string[]): Text {
  const inside = new Map<Edge, number[]>();
  const described: Text[] = [];
  for (const place of places) {
    const at = place.lastIndexOf("@");
    const edge = fs.graph.edges.find((e) => e.name === place.slice(0, at));
    if (edge === undefined) continue;
    const point = new EdgePoint(edge.forward, Number(place.slice(at + 1)));
    if (point.vertex(fs) !== undefined) described.push(point.describeText(fs));
    else inside.set(edge, [...(inside.get(edge) ?? []), point.index]);
  }
  for (const [edge, indices] of inside) {
    const letters = fs.g.image(edge.forward).letters;
    const cuts = new Set(indices);
    described.unshift([
      "g(",
      { strip: edge.name },
      ") = ",
      ...letters.flatMap((x, i): TextPart[] => [
        ...(i === 0 ? [] : [cuts.has(i) ? " | " : " "]),
        { strip: x.name },
      ]),
    ]);
  }
  return [
    `Inefficiency ${places.length === 1 ? "point" : "points"}: `,
    ...described.flatMap((text, i) => [...(i === 0 ? [] : ["; "]), ...text]),
  ];
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");
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
    case "fold": {
      const at = move.at;
      const choices = foldVariants(fs, move, (copy, choose) => {
        if (at === undefined)
          removePeripheralInefficiency(
            copy,
            move.strips.map((n) => strip(copy, n)),
            choose,
          );
        else {
          const p = inefficiencyAt(copy, new EdgePoint(strip(copy, at.strip), at.index));
          if (p !== undefined) removeInefficiencyStep(copy, p, choose);
        }
      });
      if (at === undefined) return choices;
      // One way to remove a whole inefficiency at once for each inefficiency point behind this fold.
      const candidate = foldCandidates(fs).find((c) =>
        sameNames(
          c.edgesToFold.map((e) => e.name),
          move.strips,
        ),
      );
      const places = candidate?.places.length ? candidate.places : [`${at.strip}@${at.index}`];
      return [
        ...choices,
        ...places.flatMap((place) => {
          const split = place.lastIndexOf("@");
          const edge = fs.graph.edges.find((e) => e.name === place.slice(0, split));
          const point = edge && new EdgePoint(edge.forward, Number(place.slice(split + 1)));
          const p = point && inefficiencyAt(fs, point);
          // Of order 1, removing it completely is the fold itself (and pulling tight, the next suggestion).
          if (point === undefined || p === undefined || p.order <= 1) return [];
          const remove = {
            kind: "remove inefficiency" as const,
            at: { strip: point.edge.name, index: point.index },
            steps: "all" as const,
          };
          // Tried on a copy (a few ms): does one of its folds need the Case 2 subdivision first?
          const case2 = (() => {
            try {
              const copy = fs.copy();
              copy.onError = () => {};
              return narrated(() => applyMove(copy, remove)).steps.some((t) =>
                plainText(t).startsWith("Case 2"),
              );
            } catch {
              return false;
            }
          })();
          return [
            {
              move: remove,
              label: [
                "Remove the inefficiency at ",
                ...point.describeText(fs),
                " completely: ",
                p.order === 1 ? "one fold" : `its ${p.order} folds one after the other`,
                ", then pull tight",
                ...(case2 ? [" (with a Case 2: a first letter is split before folding)"] : []),
              ] as Text,
            },
          ];
        }),
      ];
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
    case "split junctions": {
      if (move.piece !== undefined) return [];
      return splitPieces(fs).pieces.map((piece, i) => ({
        move: { ...move, piece: i },
        label: [
          "Continue on ",
          ...strips(names(piece.edges)),
          ...(piece.period > 1 ? [` (period ${piece.period})`] : []),
        ] as Text,
        rating: piece.period,
      }));
    }
    case "cut along a singular leaf": {
      const tt = trainTrack(fs);
      const all = prongs(tt);
      const q = fs.graph.vertices.find((v) => v.name === move.junction);
      if (q === undefined) return [];
      if (cutTooFine(tt, q))
        throw new Error("the preimages of the leaf are too short for the floating-point cut");
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

/** How many more side crossings (in total, after the fold) than the best fold option the offered ones may have. */
const MORE_SIDE_CROSSINGS = 2;

/** Tries a folding move on a copy to collect its fold options, and turns them into variants of `move`. */
function foldVariants<
  M extends Extract<Move, { kind: "fold" | "fold peripheral inefficiency" | "remove inefficiency" }>,
>(
  fs: FibredSurface,
  move: M,
  run: (copy: FibredSurface, choose: (options: FoldOption[]) => FoldOption) => void,
): MoveOption[] {
  // The names are read while choosing: the fold itself may rename the kept strip afterwards. The move refers to the
  // strips of that moment (after a Case 2 subdivision there are new ones); the labels use the names of now: the strip
  // ends at the junction keep their places in its cyclic order.
  let options: { ref: FoldRef; sideCrossings: number; label: Text }[] = [];
  const copy = fs.copy();
  copy.onError = () => {};
  quietly(() =>
    run(copy, (offered) => {
      const now = (x: OrientedEdge): string => {
        if (fs.graph.edges.some((e) => e.name === x.edge.name)) return x.name;
        const v = fs.graph.vertices.find((u) => u.name === x.source.name);
        const y = v === undefined ? undefined : fs.graph.star(v)[copy.graph.star(x.source).indexOf(x)];
        return y?.name ?? x.name;
      };
      options = offered.map((o) => ({
        ref: foldRef(o),
        sideCrossings: o.sideCrossings,
        label: foldChoiceLabel(o, now),
      }));
      return offered[0] as FoldOption;
    }),
  );
  // Only the embeddings of the new strip that cross at most two sides more than the best one.
  const best = Math.min(...options.map((o) => o.sideCrossings));
  return options
    .filter((o) => o.sideCrossings <= best + MORE_SIDE_CROSSINGS)
    .map(({ ref, sideCrossings, label }) => ({
      move: { ...move, fold: ref },
      label,
      rating: sideCrossings,
      ratingText: `${sideCrossings} side ${sideCrossings === 1 ? "crossing" : "crossings"}`,
    }));
}

/**
 * "Keep x; the new strip crosses B A; w moves along B A b, the new junction on d along B A" (`now` gives the names in
 * the state shown).
 */
function foldChoiceLabel(o: FoldOption, now: (x: OrientedEdge) => string): Text {
  const moves = o.isotopies.flatMap((iso, k): TextPart[] => [
    k === 0 ? "; " : ", ",
    ...(iso.kind === "new junction"
      ? ["the new junction on ", { strip: now(iso.end) }]
      : [{ junction: (iso.kind === "target" ? iso.end.target : iso.end.source).name }]),
    ` moves along ${iso.along}`,
  ]);
  return [
    "Keep ",
    { strip: now(o.preferred) },
    o.c.isEmpty ? "; the new strip crosses no side" : `; the new strip crosses ${o.c} (its μ)`,
    ...moves,
  ];
}

// ─── Autopilot ───────────────────────────────────────────────────────────────────────────────

/** The kinds the autopilot applies by default: everything except the decision how to reduce. */
export const DEFAULT_AUTOMATIC: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>([
  "collapse invariant subforest",
  "pull tight",
  "remove valence-1 junction",
  "absorb into periphery",
  "remove valence-2 junctions",
  "fold",
  "closed surface",
]);

export interface AutopilotOptions {
  /** The follow-up of the fold before the start (see `SuggestionContext`); bookkeeping steps keep it. */
  readonly followUp?: FollowUp;
  /** The suggestion kinds whose default is applied without asking; the autopilot stops at any other. */
  readonly automatic?: ReadonlySet<SuggestionKind>;
  readonly maxSteps?: number;
  /** Called after each move with the resulting surface, e.g. to add it to the history (copy it there). */
  readonly onStep?: (move: Move, surface: FibredSurface, steps: readonly Text[]) => void;
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
  let followUp = options.followUp;
  let suggestion = nextSuggestion(surface, { followUp });
  while (automatic.has(suggestion.kind) && moves.length < maxSteps) {
    const move = suggestion.autopilotMove ?? (suggestion.options[0] as MoveOption).move;
    // A fold starts a new follow-up (or ends it); the bookkeeping steps in between keep it.
    const folds = move.kind === "fold" || move.kind === "remove inefficiency";
    let next: FollowUp | undefined;
    const done = narrated(() => applyMove(surface, move, { followUp: (point) => (next = point) }));
    surface = done.result;
    if (folds) followUp = next;
    moves.push(move);
    const problems = surface.checkIntegrity();
    if (problems.length > 0) throw new Error(`After "${move.kind}":\n${problems.join("\n")}`);
    options.onStep?.(move, surface, done.steps);
    suggestion = nextSuggestion(surface, { followUp });
  }
  return { surface, moves, stoppedAt: suggestion };
}
