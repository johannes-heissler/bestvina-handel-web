import { describe, expect, it } from "vitest";
import { plainText, variants } from "../fibred/suggestions";
import { Session } from "../session/session";
import { draw } from "./drawing";

describe("the pieces of a reduction", () => {
  // A piece is a subsurface: one of its faces is the hole where the rest was cut away, whose word maps to the
  // reduction curve rather than to a boundary word of G₀.
  for (const preset of ["Reducible map", "Half twist", "Twisted stem"])
    it(`can be drawn, the complement too (${preset})`, () => {
      const session = Session.create({ kind: "preset", preset });
      for (let i = 0; i < 60 && session.suggestion().kind !== "reducible"; i++) {
        const s = session.suggestion();
        session.apply((s.autopilotMove ?? s.options[0]!.move)!);
      }
      const suggestion = session.suggestion();
      expect(suggestion.kind).toBe("reducible");
      const start = session.current;
      let complements = 0;
      for (const option of suggestion.options.filter((o) => o.move.kind === "reduce"))
        for (const choice of variants(start.surface, option.move)) {
          const node = session.apply(choice.move);
          if (plainText(choice.label).startsWith("The complement")) complements++;
          for (const view of ["trainTrack", "standard"] as const)
            expect(draw(node.model, node.surface, { view, size: 200 }).notes).toEqual([]);
          session.select(start);
        }
      expect(complements).toBeGreaterThan(0);
    });
});
