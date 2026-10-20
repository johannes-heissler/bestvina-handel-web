/**
 * Writes the example list of the cut study as JSON: `node make-examples.mjs <out.json>`.
 */
import { writeFileSync } from "node:fs";
import { type ExampleSpec, genus2PointPushTwists, genus3Twists, mulberry32, type NamedMap, pointPushes } from "./study";

const G2 = "a b A B c d C D";
const G2_REVERSED = ["a", "b"];
const G3 = "a b A B c d C D e f E F";

/** The genus-2 point pushes, named as in the presets (P_β̄ is the push along b with R⁻¹). */
function genus2Pushes(): NamedMap[] {
  const names: Record<string, [string, string]> = {
    P_a: ["P_α", "P_α⁻¹"],
    P_b: ["P_β̄⁻¹", "P_β̄"],
    P_c: ["P_γ", "P_γ⁻¹"],
    P_d: ["P_δ", "P_δ⁻¹"],
  };
  return pointPushes(G2, G2_REVERSED).flatMap((p) => {
    const [n, ni] = names[p.name] as [string, string];
    return [
      { name: n, text: p.map },
      { name: ni, text: p.inverse },
    ];
  });
}

function genus3Pushes(): NamedMap[] {
  return pointPushes(G3, []).flatMap((p) => [
    { name: p.name, text: p.map },
    { name: p.inverseName, text: p.inverse },
  ]);
}

const inverseName = (n: string) => (n.endsWith("⁻¹") ? n.slice(0, -2) : `${n}⁻¹`);

/** A freely reduced random word (no x followed by x⁻¹) of `length` letters from `gens`. */
function randomWord(gens: readonly NamedMap[], length: number, random: () => number): NamedMap[] {
  const word: NamedMap[] = [];
  while (word.length < length) {
    const x = gens[Math.floor(random() * gens.length)] as NamedMap;
    const last = word[word.length - 1];
    if (last !== undefined && last.name === inverseName(x.name)) continue;
    word.push(x);
  }
  return word;
}

const examples: ExampleSpec[] = [];
for (const preset of [
  "Point push with Dehn twists",
  "Closed genus 2",
  "Point push",
  "Point push as a composition",
  "Bestvina–Handel example 6.1",
])
  examples.push({ id: `preset:${preset}`, family: "preset", genus: 2, preset });

const g2push = genus2Pushes();
const g2twist = genus2PointPushTwists();
const g2all = [...g2push, ...g2twist];
const byName = new Map(g2all.map((m) => [m.name, m]));

// The words found by the search of port note 26 (applied in this order).
const known = [
  "P_β̄⁻¹ P_γ⁻¹ P_α⁻¹ P_β̄ D_d⁻¹ P_α⁻¹ D_c₁⁻¹ D_a⁻¹",
  "P_β̄ P_β̄ P_γ⁻¹ P_δ D_c₁ D_d D_c",
  "P_β̄ P_β̄⁻¹ D_d D_c₁⁻¹ D_b⁻¹ P_α D_c D_a⁻¹",
  "D_b⁻¹ D_d⁻¹ D_a⁻¹ D_d⁻¹ P_δ D_c₁ P_δ P_δ",
];
known.forEach((w, i) =>
  examples.push({
    id: `known:${i}`,
    family: "known",
    genus: 2,
    polygon: G2,
    reversed: G2_REVERSED,
    maps: w.split(" ").map((n) => {
      const m = byName.get(n);
      if (m === undefined) throw new Error(`unknown generator ${n}`);
      return m;
    }),
  }),
);

const add = (family: string, genus: number, gens: readonly NamedMap[], lengths: number[], count: number, seed0: number) => {
  for (const length of lengths)
    for (let k = 0; k < count; k++) {
      const seed = seed0 + 1000 * length + k;
      const maps = randomWord(gens, length, mulberry32(seed));
      examples.push({
        id: `${family}:L${length}:s${seed}`,
        family,
        genus,
        polygon: genus === 2 ? G2 : G3,
        reversed: genus === 2 ? G2_REVERSED : [],
        maps,
      });
    }
};

/**
 * Twist-rich words: a random twist word with `pushes` random point pushes inserted at random places. On the closed
 * surface the pushes are trivial, so the closed class is that of the twist word alone.
 */
const addTwistPush = (family: string, genus: number, twists: readonly NamedMap[], pushes: readonly NamedMap[], twistLengths: number[], pushCounts: number[], count: number, seed0: number) => {
  for (const t of twistLengths)
    for (const k of pushCounts)
      for (let i = 0; i < count; i++) {
        const seed = seed0 + 10_000 * t + 1000 * k + i;
        const random = mulberry32(seed);
        const maps = randomWord(twists, t, random);
        for (const push of randomWord(pushes, k, random)) maps.splice(Math.floor(random() * (maps.length + 1)), 0, push);
        examples.push({ id: `${family}:T${t}P${k}:s${seed}`, family, genus, polygon: genus === 2 ? G2 : G3, reversed: genus === 2 ? G2_REVERSED : [], maps });
      }
};

// Genus 2: pushes and twists mixed uniformly; twist-rich words with a few pushes; pure twist words as a control.
add("g2-mixed", 2, g2all, [4, 6, 8, 10, 12], 100, 100_000);
addTwistPush("g2-twistpush", 2, g2twist, g2push, [8, 12], [1, 2, 3], 40, 400_000);
add("g2-twists", 2, g2twist, [10], 40, 200_000);
// Genus 3: pushes and Lickorish twists.
const g3push = genus3Pushes();
const g3twist = genus3Twists();
add("g3-mixed", 3, [...g3push, ...g3twist], [6, 8, 10], 60, 300_000);
addTwistPush("g3-twistpush", 3, g3twist, g3push, [10], [2], 60, 500_000);

// The closed class of every word as a reference: its twist part alone (pushes are trivial on the closed surface).
const isPush = (m: NamedMap) => m.name.startsWith("P_");
const seen = new Set<string>();
for (const e of [...examples]) {
  if (e.maps === undefined || !e.maps.some(isPush)) continue;
  const twists = e.maps.filter((m) => !isPush(m));
  const key = `${e.genus}:${twists.map((m) => m.name).join(" ")}`;
  if (seen.has(key)) continue;
  seen.add(key);
  examples.push({ id: `ref:${e.id}`, family: `ref-g${e.genus}`, genus: e.genus, polygon: e.polygon as string, reversed: e.reversed ?? [], maps: twists });
}

writeFileSync(process.argv[2] as string, JSON.stringify(examples, null, 1));
console.log(`${examples.length} examples`);
