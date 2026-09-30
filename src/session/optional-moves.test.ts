import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATIC } from "../fibred/suggestions";
import { Session } from "./session";

describe("moves beyond the original algorithm", () => {
  it("offers moving vertices as a step, the one lowering λ most first", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      const s = session.suggestion();
      if (s.kind === "move vertices") {
        found = true;
        const ratings = s.options.map((o) => o.rating as number);
        expect(ratings).toEqual(ratings.toSorted((x, y) => x - y));
        expect(s.options.every((o) => o.move.kind === "move junction image" && !o.discouraged)).toBe(true);
      } else session.apply((s.autopilotMove ?? s.options[0]!.move)!);
    }
    expect(found).toBe(true);
  });

  it("switched off, are greyed out and not applied automatically", () => {
    const vertices = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    vertices.disabled = new Set(["move vertices"]);
    for (let i = 0; i < 12; i++) {
      const s = vertices.suggestion();
      expect(s.kind).not.toBe("move vertices");
      for (const o of s.options.filter((x) => x.move.kind === "move junction image")) {
        expect(o.discouraged).toBe(true);
        expect(o.warning).toMatch(/Switched off/);
      }
      if (s.kind === "finished") break;
      vertices.apply((s.autopilotMove ?? s.options[0]!.move)!);
    }
    vertices.runAutopilot({ automatic: new Set([...DEFAULT_AUTOMATIC]) });
    expect(vertices.path().some((n) => n.move?.kind === "move junction image")).toBe(false);

    const reducible = Session.create({ kind: "preset", preset: "Reducible map" });
    reducible.disabled = new Set(["reduce"]);
    const s = reducible.suggestion();
    expect(s.kind).toBe("reducible");
    for (const o of s.options.filter((x) => x.move.kind === "reduce" || x.move.kind === "split junctions"))
      expect(o.discouraged).toBe(true);
    const stopped = reducible.runAutopilot({ automatic: new Set([...DEFAULT_AUTOMATIC, "reducible"]) });
    expect(stopped.kind).toBe("reducible");
    expect(reducible.path()).toHaveLength(1);
  });
});
