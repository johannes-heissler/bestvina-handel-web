/**
 * Explanations of what a move does, step by step (subdivisions, isotopies of junctions, folds, …), collected while
 * the move is applied: the moves call {@link narrate}, and {@link narrated} collects the steps. Trying moves on copies
 * (to rate options) runs {@link quietly}, so that it doesn't add to the explanation.
 *
 * With `states`, {@link narrated} also keeps a copy of the surface at each step, as it was before the step (the
 * surface the move works on, see {@link about}), for showing the move step by step. A step that is narrated after
 * it happened passes its state from before ({@link stateNow}).
 *
 * @module
 */
import type { FibredSurface } from "./fibred-surface";
import type { Text } from "./suggestions";

/** A junction moving across a side of the model in one step (for animating the isotopy). */
export interface Motion {
  /** The name of the junction. */
  readonly junction: string;
  /** The name of the oriented edge of G₀ through whose port the junction leaves (it enters through the reverse). */
  readonly side: string;
}

/** One step of an explanation, the surface before it (if kept), and a motion it consists of (if any). */
export interface NarratedStep {
  readonly text: Text;
  readonly before?: FibredSurface;
  readonly motion?: Motion;
}

let steps: NarratedStep[] | undefined;
let keepStates = false;
/** The surface that the move being narrated changes (in place). */
let subject: FibredSurface | undefined;

/**
 * Adds a step to the explanation being collected (if any), with the surface as it is before the step, or `before`
 * for a step narrated after it happened.
 */
export function narrate(
  step: Text,
  options: { before?: FibredSurface | undefined; motion?: Motion } = {},
): void {
  if (steps === undefined) return;
  const before = options.before ?? stateNow();
  steps.push({ text: step, ...(before && { before }), ...(options.motion && { motion: options.motion }) });
}

/** A copy of the surface now, if the steps keep their states (to pass to a later {@link narrate}). */
export function stateNow(): FibredSurface | undefined {
  return steps !== undefined && keepStates && subject !== undefined ? subject.copy() : undefined;
}

/** Runs `action`, which changes `fs` in place, with `fs` as the surface whose states the steps keep. */
export function about<T>(fs: FibredSurface, action: () => T): T {
  const saved = subject;
  subject = fs;
  try {
    return action();
  } finally {
    subject = saved;
  }
}

/** Runs `action` and returns the steps it narrated (nested calls collect their own steps). */
export function narrated<T>(
  action: () => T,
  options: { states?: boolean } = {},
): { result: T; steps: Text[]; narrated: NarratedStep[] } {
  const [saved, savedKeep] = [steps, keepStates];
  const collected: NarratedStep[] = [];
  steps = collected;
  keepStates = options.states ?? false;
  try {
    const result = action();
    return { result, steps: collected.map((s) => s.text), narrated: collected };
  } finally {
    steps = saved;
    keepStates = savedKeep;
  }
}

/** Runs `action` without narrating (e.g. trying an option on a copy). */
export function quietly<T>(action: () => T): T {
  const saved = steps;
  steps = undefined;
  try {
    return action();
  } finally {
    steps = saved;
  }
}
