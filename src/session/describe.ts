/**
 * Short descriptions of moves, for the history (the labels of its edges) and the navigation buttons, as structured
 * text so that strip names are shown in their colours.
 *
 * @module
 */
import type { Move } from "../fibred/move";
import { plainText, type Text, type TextPart } from "../fibred/suggestions";

const strips = (names: readonly string[]): TextPart[] =>
  names.flatMap((name, i) => (i === 0 ? [{ strip: name }] : [", ", { strip: name }]));
const junctions = (names: readonly string[]): TextPart[] =>
  names.flatMap((name, i) => (i === 0 ? [{ junction: name }] : [", ", { junction: name }]));

export function describeMove(move: Move): Text {
  switch (move.kind) {
    case "collapse invariant subforest":
      return [
        "Collapse ",
        ...strips(move.strips),
        ...(move.centers?.length ? [" onto ", ...junctions(move.centers)] : []),
      ];
    case "pull tight":
      return move.at === undefined ? ["Pull tight"] : ["Pull tight at ", ...strips(move.at)];
    case "remove valence-1 junction":
      return ["Remove valence-1 ", ...junctions(move.junctions)];
    case "absorb into periphery":
      return ["Absorb into the periphery"];
    case "reduce":
      return [
        "Reduce along ",
        ...strips(move.preserved),
        ...(move.piece !== undefined ? [` (piece ${move.piece + 1})`] : []),
      ];
    case "ignore reducibility":
      return ["Ignore reducibility"];
    case "set peripheral subgraph":
      return move.strips.length === 0 ? ["P = ∅"] : ["P = ", ...strips(move.strips)];
    case "ignore peripheral subgraph":
      return ["Ignore the peripheral subgraph"];
    case "move junction image":
      return ["Move g(", { junction: move.junction }, ") along ", { strip: move.along }];
    case "split junctions":
      return ["Split junctions along τ", ...(move.piece !== undefined ? [` (piece ${move.piece + 1})`] : [])];
    case "remove valence-2 junctions":
      return move.junctions === undefined
        ? ["Remove valence-2 junctions"]
        : ["Remove valence-2 ", ...junctions(move.junctions)];
    case "fold":
    case "fold peripheral inefficiency":
      return ["Fold ", ...strips(move.strips)];
    case "remove inefficiency":
      return [
        move.steps === "one" ? "Fold once at " : "Remove the inefficiency at ",
        { strip: move.at.strip },
        `@${move.at.index}`,
      ];
    case "cut along a singular leaf":
      return [
        "Cut along a leaf from ",
        { junction: move.junction },
        ...(move.realBranches !== undefined ? [` (${move.realBranches} branches)`] : []),
      ];
    case "replace puncture by singularity":
      return ["Fill the puncture at ", { junction: move.junction }];
    case "edit map": {
      const map = move.name ?? "a map";
      return [
        move.mode === "replace"
          ? `Edit the map${move.name === undefined ? "" : ` to ${move.name}`}`
          : `${move.mode === "postcompose" ? `Apply ${map} after g` : `Apply ${map} before g`}`,
      ];
    }
    case "rename map":
      return [move.name === undefined ? "Remove the name of the map" : `Rename the map to ${move.name}`];
    case "rename strip":
      return ["Rename ", { strip: move.strip }, " to ", { strip: move.name }];
    case "rename junction":
      return ["Rename ", { junction: move.junction }, " to ", { junction: move.name }];
  }
}

/** The description as plain text (tooltips, logs). */
export function describeMoveText(move: Move): string {
  return plainText(describeMove(move));
}
