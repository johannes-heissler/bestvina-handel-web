/**
 * Explanations of what a move does, step by step (subdivisions, isotopies of junctions, folds, …), collected while
 * the move is applied: the moves call {@link narrate}, and {@link narrated} collects the steps. Trying moves on copies
 * (to rate options) runs {@link quietly}, so that it doesn't add to the explanation.
 *
 * With `states`, {@link narrated} also keeps a copy of the surface at each step, as it was before the step (the
 * surface passed to `narrate`), for showing the move step by step.
 *
 * @module
 */
import type { FibredSurface } from "./fibred-surface";
import type { Text } from "./suggestions";

/** One step of an explanation, and the surface before it (if kept). */
export interface NarratedStep {
  readonly text: Text;
  readonly before?: FibredSurface;
}

let steps: NarratedStep[] | undefined;
let keepStates = false;
/** The surface that the move being narrated changes (in place). */
let subject: FibredSurface | undefined;

/** Adds a step to the explanation being collected (if any), with the surface as it is before the step. */
export function narrate(step: Text): void {
  if (steps === undefined) return;
  const before = keepStates && subject !== undefined ? subject.copy() : undefined;
  steps.push(before ? { text: step, before } : { text: step });
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
