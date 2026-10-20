import { buildExample, genus2PointPushTwists, genus3Twists, pointPushes } from "./study";
const pp = pointPushes("a b A B c d C D", ["a", "b"]);
console.log(JSON.stringify(pp, null, 1));
console.log(JSON.stringify(genus2PointPushTwists()));
const check = (polygon: string, reversed: string[], maps: { text: string; name: string }[]) => {
  for (const m of maps) {
    try {
      const fs = buildExample({ id: "", family: "", genus: 0, polygon, reversed, maps: [m] });
      const p = fs.checkIntegrity();
      console.log(m.name, m.text, p.length === 0 ? "OK" : "BAD " + p.join(";"));
    } catch (e) { console.log(m.name, m.text, "ERR", (e as Error).message); }
  }
};
check("a b A B c d C D", ["a", "b"], genus2PointPushTwists());
const g3 = "a b A B c d C D e f E F";
check(g3, [], genus3Twists());
const p3 = pointPushes(g3, []);
check(g3, [], p3.flatMap((p) => [{ name: p.name, text: p.map }, { name: p.inverseName, text: p.inverse }]));
// push then its inverse = identity?
for (const p of p3) {
  const fs = buildExample({ id: "", family: "", genus: 0, polygon: g3, reversed: [], maps: [{ name: "x", text: p.map }, { name: "y", text: p.inverse }] });
  console.log(p.name, "∘ inverse:", fs.toString());
}
