/**
 * The Bestvina–Handel algorithm without user interaction: the priority order of the C# `NextSuggestion`, each
 * step applied with its default choices (the C# `ApplyNextSuggestion` / `BestvinaHandelAlgorithm`).
 *
 * The typed suggestion system for the UI (port note 07) will offer the same steps with their options.
 * Not ported yet: absorbing into the periphery, detecting finite order and reducibility, and converting into
 * a train track.
 *
 * @module
 */
import type { FibredSurface } from "./fibred-surface";
import type { Edge, OrientedEdge } from "../graph/ribbon-graph";
import { collapseSubforest, invariantSubforests, isPeripheryFriendlyForest } from "./moves/collapse-forest";
import {
  inefficiencies,
  peripheralInefficiencies,
  removeInefficiency,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { loosePositions, pullTight } from "./moves/pull-tight";
import { perronFrobenius } from "./perron-frobenius";
import { finiteOrder, type ReductionCandidate, reductionCandidates } from "./moves/reducibility";
import {
  defaultStripToRemove,
  removeValenceOneJunction,
  removeValenceTwoJunction,
  valenceOneJunctions,
  valenceTwoJunctions,
} from "./moves/valence";

/** The kinds of steps, in the order in which the algorithm tries them. */
export type StepKind =
  | "collapse invariant subforest"
  | "pull tight"
  | "remove valence-1 junction"
  | "remove valence-2 junctions"
  | "fold peripheral inefficiency"
  | "remove inefficiency";

/** A step that can be applied to the fibred surface it was computed for. */
export interface Step {
  readonly kind: StepKind;
  readonly apply: () => void;
}

/** The next step with its default choices, or `undefined` if none applies (the map is efficient). */
export function nextStep(fs: FibredSurface): Step | undefined {
  const forests = invariantSubforests(fs);
  if (forests.length > 0)
    return {
      kind: "collapse invariant subforest",
      apply: () => collapseSubforest(fs, forestsToCollapse(fs, forests)),
    };
  if (loosePositions(fs).size > 0) return { kind: "pull tight", apply: () => pullTight(fs) };
  const [v] = valenceOneJunctions(fs);
  if (v !== undefined)
    return { kind: "remove valence-1 junction", apply: () => removeValenceOneJunction(fs, v) };
  // The algorithm stops at a graph automorphism (finite order) and, unless told to ignore it, at a reduction.
  if (finiteOrder(fs) !== undefined) return undefined;
  if (!fs.ignoreReducible && reductionCandidates(fs).length > 0) return undefined;
  if (valenceTwoJunctions(fs).length > 0)
    return { kind: "remove valence-2 junctions", apply: () => removeAllValenceTwoJunctions(fs) };
  const [group] = peripheralInefficiencies(fs);
  if (group !== undefined)
    return { kind: "fold peripheral inefficiency", apply: () => removePeripheralInefficiency(fs, group) };
  const [p] = inefficiencies(fs);
  if (p !== undefined) return { kind: "remove inefficiency", apply: () => removeInefficiency(fs, p) };
  return undefined;
}

/** What the algorithm has found out about the mapping class. */
export type Classification =
  | { readonly kind: "finite order"; readonly order: number }
  | { readonly kind: "reducible"; readonly candidates: readonly ReductionCandidate[] }
  | { readonly kind: "pseudo-Anosov"; readonly growth: number }
  | { readonly kind: "undecided" };

/**
 * The classification at the current state: finite order if g is a graph automorphism; reducible if an invariant proper
 * subgraph contains essential strips (unless ignored); pseudo-Anosov if no step applies anymore and the growth is > 1
 * (checking that τ is a filling train track with cusps everywhere is a separate question, see `train-track.ts`);
 * otherwise undecided.
 */
export function classify(fs: FibredSurface): Classification {
  const order = finiteOrder(fs);
  if (order !== undefined) return { kind: "finite order", order };
  const candidates = fs.ignoreReducible ? [] : reductionCandidates(fs);
  if (candidates.length > 0) return { kind: "reducible", candidates };
  if (nextStep(fs) !== undefined) return { kind: "undecided" };
  const { growth } = perronFrobenius(fs, { essentialOnly: true });
  return growth > 1 + 1e-9 ? { kind: "pseudo-Anosov", growth } : { kind: "undecided" };
}

/**
 * Applies {@link nextStep} until no step applies or `maxSteps` is reached, checking the integrity after each
 * step. Returns the kinds of the applied steps.
 *
 * @throws Error if a step leaves the fibred surface inconsistent.
 */
export function runAlgorithm(fs: FibredSurface, maxSteps = 20 * fs.graph.edgeCount + 20): StepKind[] {
  const log: StepKind[] = [];
  for (let step = nextStep(fs); step !== undefined && log.length < maxSteps; step = nextStep(fs)) {
    step.apply();
    log.push(step.kind);
    const problems = fs.checkIntegrity();
    if (problems.length > 0) throw new Error(`After "${step.kind}":\n${problems.join("\n")}`);
  }
  return log;
}

/** Removes valence-2 junctions one by one, stopping when an invariant subforest appears (as in C#). */
function removeAllValenceTwoJunctions(fs: FibredSurface): void {
  // The widths only decide which of the two strips is removed; computing them once for the batch is enough.
  const { widths } = perronFrobenius(fs, { essentialOnly: true });
  for (let [v] = valenceTwoJunctions(fs); v !== undefined; [v] = valenceTwoJunctions(fs)) {
    const [s0, s1] = fs.graph.star(v) as [OrientedEdge, OrientedEdge];
    removeValenceTwoJunction(fs, v, defaultStripToRemove(fs, s0, s1, widths));
    if (invariantSubforests(fs).length > 0) return;
  }
}

/**
 * The union of all maximal invariant subforests, if it is still a periphery-friendly forest (then they can be
 * collapsed at once); otherwise the first one.
 */
function forestsToCollapse(fs: FibredSurface, forests: readonly Set<Edge>[]): Set<Edge> {
  const union = new Set(forests.flatMap((f) => [...f]));
  return isPeripheryFriendlyForest(fs, union) ? union : (forests[0] as Set<Edge>);
}
