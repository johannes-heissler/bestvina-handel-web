/**
 * The Bestvina–Handel algorithm without user interaction, on top of the suggestion system (`suggestions.ts`):
 * {@link nextStep} applies the default of the next suggestion if it changes the surface in place, and
 * {@link runAlgorithm} repeats that. The closed-surface moves replace the surface; for them, use `autopilot`.
 *
 * @module
 */
import type { FibredSurface } from "./fibred-surface";
import { applyMove } from "./move";
import { finiteOrder, reductionCandidates } from "./moves/reducibility";
import { type Classification, type MoveOption, nextSuggestion, type SuggestionKind } from "./suggestions";

export type { Classification } from "./suggestions";

/** The kinds of steps that {@link nextStep} applies, in the order in which the algorithm tries them. */
export type StepKind = Exclude<SuggestionKind, "reducible" | "closed surface" | "finished">;

const STEP_KINDS: ReadonlySet<SuggestionKind> = new Set<StepKind>([
  "collapse invariant subforest",
  "pull tight",
  "remove valence-1 junction",
  "absorb into periphery",
  "remove valence-2 junctions",
  "fold",
]);

/** A step that can be applied to the fibred surface it was computed for. */
export interface Step {
  readonly kind: StepKind;
  readonly apply: () => void;
}

/**
 * The next step with its default choices, or `undefined` if the algorithm stops here: finished, at a reduction (unless
 * ignored), or at the closed-surface move.
 */
export function nextStep(fs: FibredSurface): Step | undefined {
  const suggestion = nextSuggestion(fs);
  if (!STEP_KINDS.has(suggestion.kind)) return undefined;
  const move = suggestion.autopilotMove ?? (suggestion.options[0] as MoveOption).move;
  return { kind: suggestion.kind as StepKind, apply: () => void applyMove(fs, move) };
}

/**
 * The classification at the current state: finite order if g is a graph automorphism; reducible if an invariant proper
 * subgraph contains essential strips (unless ignored); pseudo-Anosov if the algorithm is finished and the growth is > 1
 * (checking that τ is a filling train track with cusps everywhere is a separate question, see `train-track.ts`);
 * otherwise undecided.
 */
export function classify(fs: FibredSurface): Classification {
  const order = finiteOrder(fs);
  if (order !== undefined) return { kind: "finite order", order };
  const candidates = fs.ignoreReducible ? [] : reductionCandidates(fs);
  if (candidates.length > 0) return { kind: "reducible", candidates };
  const suggestion = nextSuggestion(fs);
  return suggestion.kind === "finished" && suggestion.classification !== undefined
    ? suggestion.classification
    : { kind: "undecided" };
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
