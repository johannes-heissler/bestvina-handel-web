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
import { collapseSubforest, invariantSubforests } from "./moves/collapse-forest";
import {
  inefficiencies,
  peripheralInefficiencies,
  removeInefficiency,
  removePeripheralInefficiency,
} from "./moves/inefficiency";
import { loosePositions, pullTight } from "./moves/pull-tight";
import {
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
  const [forest] = invariantSubforests(fs);
  if (forest !== undefined)
    return { kind: "collapse invariant subforest", apply: () => collapseSubforest(fs, forest) };
  if (loosePositions(fs).size > 0) return { kind: "pull tight", apply: () => pullTight(fs) };
  const [v] = valenceOneJunctions(fs);
  if (v !== undefined)
    return { kind: "remove valence-1 junction", apply: () => removeValenceOneJunction(fs, v) };
  if (valenceTwoJunctions(fs).length > 0)
    return { kind: "remove valence-2 junctions", apply: () => removeAllValenceTwoJunctions(fs) };
  const [group] = peripheralInefficiencies(fs);
  if (group !== undefined)
    return { kind: "fold peripheral inefficiency", apply: () => removePeripheralInefficiency(fs, group) };
  const [p] = inefficiencies(fs);
  if (p !== undefined) return { kind: "remove inefficiency", apply: () => removeInefficiency(fs, p) };
  return undefined;
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
  for (let [v] = valenceTwoJunctions(fs); v !== undefined; [v] = valenceTwoJunctions(fs)) {
    removeValenceTwoJunction(fs, v);
    if (invariantSubforests(fs).length > 0) return;
  }
}
