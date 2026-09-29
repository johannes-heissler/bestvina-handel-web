import { describe, expect, it } from "vitest";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { plainText, variants } from "./suggestions";

// After a fold whose inefficiency (order 1) is at the valence-2 junction between b₁ and b; the same fold is behind
// further inefficiency points, three of them inside g(b).
const LINK =
  "s=tZJNasMwEIWvYt56Upr0Z6Fd0ix6hRK8kO1xrVaRjCQbgzG0vUJvmJMUOykNCU4oJMxCw0jzvsdoWuTWrWWAQMI-1MrISSFNxnri2XtlDQg1uyETM4IP0gWIFu_KZBAoHXsOoN9EYLHT2Xx8Pw9KETdyXWqOHm-m6AjBMfcKaaF05thArFqsbc17srnVGXqaU6WHWGEBwhIxQQ704QICEgRlMm4g7jvatom2N5Ozc9xLLUFId-eWAnQdncSXldZRUK9FwJmXR0YTEOYnjd6NGE12Rq_prh_CEwh9dXHG5fVczEFITtIfLkd33BeiWmo2KU9m0Vtl0qCs8ec6U6u1LD1HytTSKWlC5Kskt459OPjz-L8jkFMQmuMZNPsLfd0tfTmmJ3_06QE97ugysiPLv_n6HNn_uBsPQlo5xyZArG5pJOLuBw";

describe("the choices of a fold", () => {
  it("show the inefficiency points of one image together, and only the fold choices near the best", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK)) ?? expect.fail("no session"));
    const option = session.suggestion().options[0] ?? expect.fail("no option");
    expect(plainText(option.details ?? [])).toContain("g(b) = a X B | B₁ | Z;");

    const choices = variants(session.current.surface, option.move);
    const folds = choices.filter((c) => c.move.kind === "fold");
    const best = Math.min(...folds.map((c) => c.rating ?? Infinity));
    expect(folds.length).toBeGreaterThan(0);
    for (const c of folds) {
      expect(c.rating).toBeLessThanOrEqual(best + 2);
      expect(c.ratingText).toBe(`${c.rating} side ${c.rating === 1 ? "crossing" : "crossings"}`);
    }
    // Removing an inefficiency of order 1 completely is just the fold: not offered.
    const removals = choices.filter((c) => c.move.kind === "remove inefficiency");
    expect(removals.some((c) => c.move.kind === "remove inefficiency" && c.move.at.index === 0)).toBe(false);
    expect(removals.length).toBeGreaterThan(0);
  });
});
