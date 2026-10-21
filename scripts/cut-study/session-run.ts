/**
 * The default path through the UI's Session (with the remarking that keeps the model, so μ is kept through the cuts):
 * `node session-run.mjs <preset name> <maxCuts>`. Prints one line per closed-surface move.
 */
import { Session } from "../../src/session/session";
import { trainTrack } from "../../src/fibred/train-track";
import { punctureCount } from "../../src/fibred/moves/cut-closed-surface";
import { AUTOMATIC, nodeInfo } from "./study";

const [name, maxArg] = process.argv.slice(2) as [string, string];
const session = Session.create({ kind: "preset", preset: name });
const t0 = performance.now();
let s = session.runAutopilot({ automatic: AUTOMATIC, maxSteps: 1_000_000 });
if (s.kind !== "closed surface") {
  session.apply({ kind: "mark as closed" });
  s = session.runAutopilot({ automatic: AUTOMATIC, maxSteps: 1_000_000 });
}
for (let k = 0; k < Number(maxArg) && s.kind === "closed surface"; k++) {
  const fs = session.current.surface;
  const info = nodeInfo(fs);
  const move = s.options[0]!.move;
  console.log(JSON.stringify({ k, punctures: info.punctures, growth: info.growth, strips: info.size.strips, orbits: info.orbits.map((o) => o.period), model: session.current.model.kind, move, secs: (performance.now() - t0) / 1000 }));
  session.apply(move);
  s = session.runAutopilot({ automatic: AUTOMATIC, maxSteps: 1_000_000 });
}
const tt = trainTrack(session.current.surface);
console.log(JSON.stringify({ end: s.kind, classification: s.classification, punctures: punctureCount(tt), model: session.current.model.kind, secs: (performance.now() - t0) / 1000 }));
