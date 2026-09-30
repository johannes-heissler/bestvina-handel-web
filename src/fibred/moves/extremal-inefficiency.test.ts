import { describe, expect, it } from "vitest";
import { decodeSession } from "../../session/share";
import { Session } from "../../session/session";
import { plainText } from "../suggestions";
import { foldCandidates, inefficiencies } from "./inefficiency";

// A session whose last fold leaves its inefficiency at the valence-2 junction p between b₁ and b (both ends in the
// same gate): g(b₁ b) = b | a X B B₁ Z, which folds B and a next.
const LINK =
  "tZJNasMwEIWvYt56Upr0Z6Fd0ix6hRK8kO1xrVaRjCQbgzG0vUJvmJMUOykNCU4oJMxCw0jzvsdoWuTWrWWAQMI-1MrISSFNxnri2XtlDQg1uyETM4IP0gWIFu_KZBAoHXsOoN9EYLHT2Xx8Pw9KETdyXWqOHm-m6AjBMfcKaaF05thArFqsbc17srnVGXqaU6WHWGEBwhIxQQ704QICEgRlMm4g7jvatom2N5Ozc9xLLUFId-eWAnQdncSXldZRUK9FwJmXR0YTEOYnjd6NGE12Rq_prh_CEwh9dXHG5fVczEFITtIfLkd33BeiWmo2KU9m0Vtl0qCs8ec6U6u1LD1HytTSKWlC5Kskt459OPjz-L8jkFMQmuMZNPsLfd0tfTmmJ3_06QE97ugysiPLv_n6HNn_uBsPQlo5xyZArG5pJOLuBw";

describe("gatewise extremal junctions of valence 2", () => {
  it("are inefficiencies, and the follow-up of the last fold is marked by its place", async () => {
    const { session } = Session.fromFile((await decodeSession("s=" + LINK)) ?? expect.fail("no session"));
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const fs = session.current.surface;
    expect(session.current.followUp?.point).toEqual({ strip: "b", index: 0 });

    const atP = inefficiencies(fs).find((p) => p.point.index === 0);
    expect(atP?.point.describe(fs)).toBe("g(b₁ b) = b|a X B B₁ Z");
    expect(atP?.order).toBe(1);
    expect(foldCandidates(fs).some((c) => c.places.includes("b@0") && c.order === 1)).toBe(true);

    const suggestion = session.suggestion();
    const first = suggestion.options[0];
    expect(plainText(first?.label ?? [])).toContain("Next fold of the last inefficiency");
    expect(first?.move).toEqual({ kind: "fold", strips: ["B", "a"], at: { strip: "b", index: 0 } });

    const preview = session.preview(first?.move ?? expect.fail("no move"));
    expect(preview.error).toBeUndefined();
    const texts = preview.steps.map((s) => plainText(s.text));
    expect(texts[0]).toContain("g(b₁ b) = b | a X B B₁ Z");
    expect(texts.join("\n")).toContain("the initial segment is called b₁₁"); // b₁ is taken
    expect(texts.at(-1)).toContain("backtracking (order 0)");
    session.commit(preview);
    expect(session.suggestion().kind).toBe("pull tight");
  });
});
