import { describe, expect, it } from "vitest";
import { spineOfGraph } from "../examples/models";
import { Complex } from "../math/complex";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { chartOf } from "./chart";
import { layout } from "./layout";

// A state with nine strips on the genus-2 octagon, several of them crossing the same sides.
const LINK =
  "s=tZJNasMwEIWvYt56Upr0Z6Fd0ix6hRK8kO1xrVaRjCQbgzG0vUJvmJMUOykNCU4oJMxCw0jzvsdoWuTWrWWAQMI-1MrISSFNxnri2XtlDQg1uyETM4IP0gWIFu_KZBAoHXsOoN9EYLHT2Xx8Pw9KETdyXWqOHm-m6AjBMfcKaaF05thArFqsbc17srnVGXqaU6WHWGEBwhIxQQ704QICEgRlMm4g7jvatom2N5Ozc9xLLUFId-eWAnQdncSXldZRUK9FwJmXR0YTEOYnjd6NGE12Rq_prh_CEwh9dXHG5fVczEFITtIfLkd33BeiWmo2KU9m0Vtl0qCs8ec6U6u1LD1HytTSKWlC5Kskt459OPjz-L8jkFMQmuMZNPsLfd0tfTmmJ3_06QE97ugysiPLv_n6HNn_uBsPQlo5xyZArG5pJOLuBw";

describe("the part of the sides that the strands cross", () => {
  it("spreads the crossings further towards the ends of the sides when it is larger", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    const fs = session.current.surface;
    const spread = (sideFraction: number) => {
      const chart = chartOf(session.current.model, {}, spineOfGraph(session.current.model, fs.spine0), {
        sideFraction,
      });
      const lines = layout(fs, chart, { widthExponent: 0, smoothing: 0 }).strips;
      // The crossings: the ends of the pieces of the strips on the sides (Klein coordinates).
      const ends = [...lines.values()].flatMap((pieces) =>
        pieces.slice(1).map((piece) => piece[0] as Complex),
      );
      expect(ends.length).toBeGreaterThan(4);
      // How far from the middle of its side the outermost crossing is.
      const middles = [...chart.ports.values()].map((p) => p.left.add(p.right).scale(0.5));
      return Math.max(...ends.map((z) => Math.min(...middles.map((m) => m.sub(z).abs()))));
    };
    // Evenly spaced (no straightening): three times the part, three times as far out.
    expect(spread(0.9) / spread(0.3)).toBeCloseTo(3, 1);
  });
});
