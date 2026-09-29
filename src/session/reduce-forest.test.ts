import { describe, expect, it } from "vitest";
import { reductionCandidates } from "../fibred/moves/reducibility";
import { plainText, variants } from "../fibred/suggestions";
import { Session } from "./session";
import { decodeSession } from "./share";

// g(d) = d: the orbit {d} is a tree from s to r, both on the peripheral circle a b x.
const LINK =
  "s=rZDBasQwDER_xczZC9ndmz-j15CDY6uJW0cOkhNYQv69pGVh20J7aNFlDpo3I214LjL5CoeetK6J_Wn0HCmflFRTYVisJO_KXSy0eqlwG14TRzjMQkoV9i4cnjzHMpnJz3PiwYTsVU1iMxAvai6wUKIId90tqhAdsDCmHIUYrt0wlZUeE5acTU3DWLHbHzd1zqmal4VDTYX1KJUoEFzz2djt9ptXKC6B7nfIejRs4WHRo_s7KMAiPoDO_9Xo_MtPfK9FepO4FjOTpHkkueFr-sdYhEWEuMK1jb3aptvfAA";

describe("an invariant forest as a reduction candidate", () => {
  it("is offered together with the components of the periphery it touches, and reduces", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    const fs = session.current.surface;
    const forest = reductionCandidates(fs).find((c) => c.forest);
    expect([...(forest?.preserved ?? [])].map((e) => e.name).sort()).toEqual(["a", "b", "d", "x"]);
    // No candidate has a component that is a tree.
    for (const c of reductionCandidates(fs))
      for (const component of fs.graph.components(c.preserved))
        expect(component.vertices.size).toBeLessThanOrEqual(component.edges.size);

    const option = session.suggestion().options[0]!;
    expect(plainText(option.label)).toMatch(/^Reduce along d, b, a, x \(an invariant forest/);
    const start = session.current;
    for (const choice of variants(start.surface, option.move)) {
      const node = session.apply(choice.move);
      expect(node.surface.checkIntegrity()).toEqual([]);
      session.select(start);
    }
  });
});
