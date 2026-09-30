import { describe, expect, it } from "vitest";
import { presetNamed } from "../examples/presets";
import { plainText, type Suggestion } from "../fibred/suggestions";
import { Session } from "./session";

/** Applies the first option until the suggestion is of `kind` (or the algorithm stops). */
function runTo(session: Session, kind: string): Suggestion {
  for (let i = 0; i < 60; i++) {
    const s = session.suggestion();
    if (s.kind === kind || s.kind === "finished" || s.options.length === 0) return s;
    session.apply((s.autopilotMove ?? s.options[0]!.move)!);
  }
  return session.suggestion();
}

describe("the peripheral subgraph suggestion", () => {
  it("offers the possible peripheral subgraphs when P is missing", () => {
    const stem = presetNamed("Twisted stem")!;
    const session = Session.create({ kind: "model", model: stem.model, map: stem.maps[0]!.text }); // without P
    const s = runTo(session, "peripheral subgraph");
    expect(s.kind).toBe("peripheral subgraph");
    expect(plainText(s.description)).toMatch(/form 2 orbits/);
    expect(s.options.map((o) => plainText(o.label))).toEqual([
      "P = p",
      "Ignore and continue with P as it is",
    ]);
    const ignore = s.options[1]!;
    expect(ignore.discouraged).toBe(true);
    expect(ignore.warning).toMatch(/not guaranteed/);
    session.apply(s.options[0]!.move);
    expect([...session.current.surface.peripheral].map((e) => e.name)).toEqual(["p"]);
    expect(session.suggestion().kind).not.toBe("peripheral subgraph");
  });

  it("says so when there is no possible choice, and only offers to ignore", () => {
    const torus = presetNamed("Random mapping class of the twice-punctured torus")!;
    const session = Session.create({
      kind: "model",
      model: torus.model,
      options: torus.options!,
      map: "b -> A b",
    });
    const s = runTo(session, "peripheral subgraph");
    expect(s.kind).toBe("peripheral subgraph");
    expect(plainText(s.description)).toMatch(/There is no possible peripheral subgraph/);
    // (Besides the greyed split along τ, which a single Dehn twist offers: it is reducible.)
    const own = s.options.filter((o) => o.move.kind !== "split junctions");
    expect(own.map((o) => o.move.kind)).toEqual(["ignore peripheral subgraph"]);
    session.apply(own[0]!.move);
    expect(session.suggestion().kind).not.toBe("peripheral subgraph");
  });

  it("marks ignoring reducibility with the warning", () => {
    const session = Session.create({ kind: "preset", preset: "Reducible map" });
    const s = runTo(session, "reducible");
    const ignore = s.options.find((o) => o.move.kind === "ignore reducibility")!;
    expect(ignore.discouraged).toBe(true);
    expect(ignore.warning).toMatch(/not guaranteed/);
  });
});
