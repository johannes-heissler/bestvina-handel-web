import { describe, expect, it } from "vitest";
import { strandOrder } from "../embedding/strand-order";
import { Session } from "../session/session";
import { bandComparison, singleGateOrders } from "./gate-order";
import { findGates } from "./gates";
import { trainTrack } from "./train-track";

/** The states of BH 6.1 along the algorithm (the default steps, without the automatic ones in between). */
function statesOfBH61() {
  const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
  const states = [session.current.surface];
  for (let i = 0; i < 30 && session.suggestion().kind !== "finished"; i++) {
    const s = session.suggestion();
    session.apply((s.autopilotMove ?? s.options[0]!.move)!);
    states.push(session.current.surface);
  }
  return states;
}

describe("the linear order of a gate", () => {
  const states = statesOfBH61();

  it("found from the strands of f[F] ⊆ F, agrees with the star at junctions with several gates", () => {
    let checked = 0;
    for (const fs of states) {
      const compare = bandComparison(fs.graph, fs.g, strandOrder(fs.g));
      const gates = findGates(fs.graph, fs.g);
      for (const v of fs.graph.vertices) {
        const here = gates.filter((gate) => gate.at === v);
        if (here.length < 2) continue;
        const star = fs.graph.star(v);
        for (const gate of here) {
          const inGate = new Set(gate.edges);
          const start = star.findIndex(
            (x, i) => inGate.has(x) && !inGate.has(star[(i - 1 + star.length) % star.length]!),
          );
          const known = [...star.slice(start), ...star.slice(0, start)].filter((x) => inGate.has(x));
          for (let i = 1; i < known.length; i++) {
            expect(compare(known[i - 1]!, known[i]!)).toBeLessThan(0);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("decides where a single gate is cut open, and the train track uses it", () => {
    let decided = 0;
    for (const fs of states) {
      const orders = singleGateOrders(fs.graph, fs.g);
      for (const [v, linear] of orders) {
        const star = fs.graph.star(v);
        const start = star.indexOf(linear[0]!);
        expect(linear).toEqual([...star.slice(start), ...star.slice(0, start)]); // a rotation of the star
        decided++;
        const tt = trainTrack(fs);
        expect(tt.singleGateOrder.get(v)).toEqual(linear);
        // The switch lists the branches in this order.
        const s = tt.switchOf.get(linear[0]!)!;
        const ends = tt.graph.star(s).map((b) => b.edge);
        expect(ends).toEqual(linear.map((x) => tt.realBranch.get(x.edge)));
      }
    }
    expect(decided).toBeGreaterThan(5);
  });
});
