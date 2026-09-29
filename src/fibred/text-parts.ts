/**
 * Small builders for structured text (strips and junctions in their colours), for the explanations of the moves.
 *
 * @module
 */
import type { OrientedEdge } from "../graph/ribbon-graph";
import type { TextPart } from "./suggestions";

/** Strip names: "a, b and c". */
export function stripsText(names: readonly string[]): TextPart[] {
  return names.flatMap((name, i) => [
    ...(i === 0 ? [] : i === names.length - 1 ? [" and "] : [", "]),
    { strip: name },
  ]);
}

/** Junction names: "p, q and r". */
export function junctionsText(names: readonly string[]): TextPart[] {
  return names.flatMap((name, i) => [
    ...(i === 0 ? [] : i === names.length - 1 ? [" and "] : [", "]),
    { junction: name },
  ]);
}

/** A path of strips: "a B c", or "·" if it is empty. */
export function lettersText(letters: readonly OrientedEdge[]): TextPart[] {
  return letters.length === 0
    ? ["·"]
    : letters.flatMap((x, i): TextPart[] => [...(i === 0 ? [] : [" "]), { strip: x.name }]);
}
