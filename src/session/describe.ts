/**
 * Short descriptions of moves, for the history (the labels of its edges) and the navigation buttons.
 *
 * @module
 */
import type { Move } from "../fibred/move";

export function describeMove(move: Move): string {
  switch (move.kind) {
    case "collapse invariant subforest":
      return `Collapse ${move.strips.join(", ")}${move.centers?.length ? ` onto ${move.centers.join(", ")}` : ""}`;
    case "pull tight":
      return move.at === undefined ? "Pull tight" : `Pull tight at ${move.at.join(", ")}`;
    case "remove valence-1 junction":
      return `Remove valence-1 ${move.junctions.join(", ")}`;
    case "absorb into periphery":
      return "Absorb into the periphery";
    case "reduce":
      return `Reduce along ${move.preserved.join(", ")}${move.piece !== undefined ? ` (piece ${move.piece + 1})` : ""}`;
    case "ignore reducibility":
      return "Ignore reducibility";
    case "remove valence-2 junctions":
      return move.junctions === undefined
        ? "Remove valence-2 junctions"
        : `Remove valence-2 ${move.junctions.join(", ")}`;
    case "fold":
      return `Fold ${move.strips.join(", ")}`;
    case "fold peripheral inefficiency":
      return `Fold ${move.strips.join(", ")}`;
    case "remove inefficiency":
      return `${move.steps === "one" ? "Fold once at" : "Remove inefficiency at"} ${move.at.strip}@${move.at.index}`;
    case "cut along a singular leaf":
      return `Cut along a leaf from ${move.junction}${move.realBranches !== undefined ? ` (${move.realBranches} branches)` : ""}`;
    case "replace puncture by singularity":
      return `Fill the puncture at ${move.junction}`;
    case "edit map":
      return move.mode === "replace"
        ? "Edit the map"
        : `${move.mode === "postcompose" ? "Postcompose" : "Precompose"} with a map`;
    case "rename strip":
      return `Rename ${move.strip} to ${move.name}`;
    case "rename junction":
      return `Rename ${move.junction} to ${move.name}`;
  }
}
