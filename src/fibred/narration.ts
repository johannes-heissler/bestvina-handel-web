/**
 * Explanations of what a move does, step by step (subdivisions, isotopies of junctions, folds, …), collected while
 * the move is applied: the moves call {@link narrate} for each step that changes the surface, and {@link explain}
 * for notes in between that change nothing (why a step is done, what it led to). {@link narrated} collects both.
 * Trying moves on copies (to rate options) runs {@link quietly}, so that it doesn't add to the explanation.
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
  /**
   * The strip end (by name) at the same junction as the moving junction's strip that it is folded with: the junction
   * moves alongside it (a subdivision point moving along c follows the strip whose μ starts with c).
   */
  readonly along?: string;
}

/**
 * One step of an explanation, the surface before it (if kept), and a motion it consists of (if any); or a note that
 * changes nothing (no state).
 */
export interface NarratedStep {
  readonly text: Text;
  readonly note?: true;
  readonly before?: FibredSurface;
  readonly motion?: Motion;
}

let steps: NarratedStep[] | undefined;
let keepStates = false;
/** The surface that the move being narrated changes (in place). */
let subject: FibredSurface | undefined;

/**
 * Adds a step that changes the surface to the explanation being collected (if any), with the surface as it is before
 * the step, or `before` for a step narrated after it happened.
 */
export function narrate(
  step: Text,
  options: { before?: FibredSurface | undefined; motion?: Motion } = {},
): void {
  if (steps === undefined) return;
  const before = options.before ?? stateNow();
  steps.push({ text: step, ...(before && { before }), ...(options.motion && { motion: options.motion }) });
}

/** Adds a note that changes nothing to the explanation being collected (if any). */
export function explain(note: Text): void {
  steps?.push({ text: note, note: true });
}

/** Whether an explanation is being collected (only then is it worth composing). */
export function narrating(): boolean {
  return steps !== undefined;
}

/** Adds steps collected by a nested {@link narrated} to the explanation being collected (if any), as they are. */
export function retell(told: readonly NarratedStep[]): void {
  steps?.push(...told);
}

/** A copy of the surface now, if the steps keep their states (to pass to a later {@link narrate}). */
export function stateNow(): FibredSurface | undefined {
  return steps !== undefined && keepStates && subject !== undefined ? subject.copy() : undefined;
}

/** Whether the steps being collected keep their states (only then are intermediate states worth building). */
export function keepingStates(): boolean {
  return steps !== undefined && keepStates;
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

/** Runs `action` and returns the steps and notes it narrated (nested calls collect their own). */
export function narrated<T>(action: () => T, options: { states?: boolean } = {}): { result: T; steps: NarratedStep[] } {
  const [saved, savedKeep] = [steps, keepStates];
  const collected: NarratedStep[] = [];
  steps = collected;
  keepStates = options.states ?? false;
  try {
    return { result: action(), steps: collected };
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
