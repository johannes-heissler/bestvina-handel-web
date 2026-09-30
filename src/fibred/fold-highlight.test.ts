import { describe, expect, it } from "vitest";
import { Session } from "../session/session";
import { foldHighlight } from "./fold-highlight";
import { type SuggestionKind, plainText, type Text } from "./suggestions";

/** BH 6.1, folded with the default options until one of the offered folds is behind inefficiencies of order 2. */
function bh61AtAFoldOfOrder2() {
  const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
  const automatic = new Set<SuggestionKind>([
    "collapse invariant subforest",
    "pull tight",
    "remove valence-2 junctions",
    "absorb into periphery",
    "move vertices",
  ]);
  const orderTwo = (o: { label: Text }) => plainText(o.label).includes("order 2");
  let suggestion = session.runAutopilot({ automatic });
  for (let n = 0; n < 10 && suggestion.kind === "fold" && !suggestion.options.some(orderTwo); n++) {
    session.apply(suggestion.options[0]!.move);
    suggestion = session.runAutopilot({ automatic });
  }
  return { surface: session.current.surface, suggestion, option: suggestion.options.find(orderTwo) };
}

describe("fold highlight", () => {
  it("highlights the folded ends and the turns folded after them", () => {
    const { surface, suggestion, option } = bh61AtAFoldOfOrder2();
    expect(suggestion.kind).toBe("fold");
    expect(plainText(option!.label)).toBe("Fold a and initial segments of X at v0: order 2, 2 places");
    const wedges = foldHighlight(surface, option!.move);
    // The fold: all of a and the first 2 of the 7 letters of g(X), in their cyclic order at v0.
    expect(wedges[0]).toEqual({ ends: ["X", "a"], kind: "fold", fractions: [2 / 7, 1] });
    // The inefficiencies of order 2 are the turn (x, c); folding X and a first maps it to a turn of order 1.
    expect(wedges.slice(1)).toEqual([{ ends: ["x", "c"], kind: "turn" }]);
  });

  it("highlights nothing for moves that don't fold", () => {
    const { surface } = bh61AtAFoldOfOrder2();
    expect(foldHighlight(surface, { kind: "pull tight" })).toEqual([]);
  });
});
