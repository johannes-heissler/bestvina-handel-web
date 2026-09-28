/**
 * Explanations of what a move does, step by step (subdivisions, isotopies of junctions, folds, …), collected while
 * the move is applied: the moves call {@link narrate}, and {@link narrated} collects the steps. Trying moves on copies
 * (to rate options) runs {@link quietly}, so that it doesn't add to the explanation.
 *
 * @module
 */
import type { Text } from "./suggestions";

let steps: Text[] | undefined;

/** Adds a step to the explanation being collected (if any). */
export function narrate(step: Text): void {
  steps?.push(step);
}

/** Runs `action` and returns the steps it narrated (nested calls collect their own steps). */
export function narrated<T>(action: () => T): { result: T; steps: Text[] } {
  const saved = steps;
  const collected: Text[] = [];
  steps = collected;
  try {
    return { result: action(), steps: collected };
  } finally {
    steps = saved;
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
