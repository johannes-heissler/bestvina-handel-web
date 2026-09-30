import { describe, expect, it } from "vitest";
import { presetNamed } from "../examples/presets";
import { peripheryCandidates, peripheryProblems } from "../fibred/periphery";
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

  it("is not suggested while no peripheral subgraph exists, and continues with P as it is", () => {
    const torus = presetNamed("Random mapping class of the twice-punctured torus")!;
    const session = Session.create({
      kind: "model",
      model: torus.model,
      options: torus.options!,
      map: "b -> A b",
    });
    // The rose: both boundary words pass its one junction, so no choice of P is possible (the State panel warns).
    expect(peripheryProblems(session.current.surface)).not.toEqual([]);
    expect(peripheryCandidates(session.current.surface)).toEqual([]);
    expect(session.suggestion().kind).not.toBe("peripheral subgraph");
    expect(session.current.surface.ignorePeriphery).toBe(false);
  });

  it("is suggested once a later graph admits a peripheral subgraph", () => {
    // Found by brute force: this map fixes both punctures, and after a few folds the circle around one of them is
    // a strip of its own.
    const session = Session.create({
      kind: "preset",
      preset: "Random mapping class of the twice-punctured torus",
      seed: 38,
    });
    expect(peripheryCandidates(session.current.surface)).toEqual([]);
    const s = runTo(session, "peripheral subgraph");
    expect(s.kind).toBe("peripheral subgraph");
    const choices = s.options.filter((o) => o.move.kind === "set peripheral subgraph");
    expect(choices.length).toBeGreaterThan(0);
    session.apply(choices[0]!.move);
    expect(session.current.surface.peripheral.size).toBeGreaterThan(0);
    expect(peripheryProblems(session.current.surface)).toEqual([]);
  });

  it("marks ignoring reducibility with the warning", () => {
    const session = Session.create({ kind: "preset", preset: "Reducible map" });
    const s = runTo(session, "reducible");
    const ignore = s.options.find((o) => o.move.kind === "ignore reducibility")!;
    expect(ignore.discouraged).toBe(true);
    expect(ignore.warning).toMatch(/not guaranteed/);
  });
});
