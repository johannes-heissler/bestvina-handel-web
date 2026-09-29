import { describe, expect, it } from "vitest";
import { plainText, variants } from "../fibred/suggestions";
import { pieceTopology } from "./analysis";
import { Session } from "./session";

describe("the surface of the graph", () => {
  it("is the whole surface at the start, and a piece with a cut after a reduction", () => {
    const session = Session.create({ kind: "preset", preset: "Reducible map" });
    expect(pieceTopology(session.current.surface)).toEqual({ genus: 2, punctures: 1, cuts: 0 });
    for (let i = 0; i < 60 && session.suggestion().kind !== "reducible"; i++) {
      const s = session.suggestion();
      session.apply((s.autopilotMove ?? s.options[0]!.move)!);
    }
    const start = session.current;
    const pieces = session
      .suggestion()
      .options.filter((o) => o.move.kind === "reduce")
      .flatMap((o) => variants(start.surface, o.move))
      .map((choice) => {
        const node = session.apply(choice.move);
        session.select(start);
        return { label: plainText(choice.label), topology: pieceTopology(node.surface) };
      });
    // Cut along one curve, the genus-2 surface with one puncture falls into two tori with one boundary component each:
    // one of them keeps the puncture.
    const subgraph = pieces.find((p) => p.label.startsWith("The invariant subgraph"));
    const complement = pieces.find((p) => p.label.startsWith("The complement"));
    expect(subgraph?.topology.genus).toBe(1);
    expect(complement?.topology.genus).toBe(1);
    expect(subgraph?.topology.cuts).toBe(1);
    expect(complement?.topology.cuts).toBe(1);
    expect((subgraph?.topology.punctures ?? 0) + (complement?.topology.punctures ?? 0)).toBe(1);
  });
});
