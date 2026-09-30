import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATIC, plainText } from "../fibred/suggestions";
import { Session } from "./session";

/** Runs the algorithm to the end (all kinds applied automatically) and returns λ of the result. */
function finish(session: Session): number | undefined {
  session.runAutopilot({ automatic: new Set([...DEFAULT_AUTOMATIC, "reducible"]) });
  const c = session.suggestion().classification;
  return c?.kind === "pseudo-Anosov" ? c.growth : undefined;
}

describe("moving the image of a junction with a single gate", () => {
  it("is offered only if it lowers λ, keeps g consistent, and leads to the same result", () => {
    const reference = finish(Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" }));
    expect(reference).toBeDefined();

    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    let tried = 0;
    for (let i = 0; i < 12; i++) {
      const s = session.suggestion();
      if (s.kind === "finished") break;
      const start = session.current;
      for (const shortcut of s.options.filter((o) => o.move.kind === "move junction image")) {
        const [before, after] = (plainText(shortcut.label).match(/λ ([\d.]+) → ([\d.]+)/) ?? [])
          .slice(1)
          .map(Number);
        expect(after).toBeLessThan(before!);
        const node = session.apply(shortcut.move);
        expect(node.surface.checkIntegrity()).toEqual([]);
        expect(finish(session)).toBeCloseTo(reference!, 6);
        tried++;
        session.select(start);
      }
      session.apply((s.autopilotMove ?? s.options[0]!.move)!);
    }
    expect(tried).toBeGreaterThan(2);
  });
});
