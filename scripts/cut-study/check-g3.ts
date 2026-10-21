import { buildExample } from "./study";
const g3 = "a b A B c d C D e f E F";
const maps = {
  "D_k₁⁻¹": "a -> b d a, c -> d b c, e -> b d e D B, f -> b d f D B",
  "D_k₁": "a -> D B a, c -> B D c, e -> D B e b d, f -> D B f b d",
  "D_k₂⁻¹": "c -> d f c, e -> f d e, a -> d f a F D, b -> d f b F D",
  "D_k₂": "c -> F D c, e -> D F e, a -> F D a d f, b -> F D b d f",
};
for (const [name, text] of Object.entries(maps)) {
  const fs = buildExample({ id: "", family: "", genus: 3, polygon: g3, reversed: [], maps: [{ name, text }] });
  console.log(name, fs.checkIntegrity().join(";") || "OK");
}
for (const k of ["k₁", "k₂"]) {
  const fs = buildExample({ id: "", family: "", genus: 3, polygon: g3, reversed: [], maps: [{ name: "x", text: (maps as any)[`D_${k}`] }, { name: "y", text: (maps as any)[`D_${k}⁻¹`] }] });
  console.log(k, fs.g.toString().replace(/\n/g, " | "));
}
