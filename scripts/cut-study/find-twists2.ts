const R = "aBAbcDCdeFEf".split("");
const inv = (c: string) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase());
const letters = "abcdefABCDEF".split("");
function reduce(w: string[]): string[] { const s: string[] = []; for (const c of w) { if (s.length && s[s.length - 1] === inv(c)) s.pop(); else s.push(c); } return s; }
function cycReduce(w: string[]): string[] { let s = reduce(w); while (s.length > 1 && s[0] === inv(s[s.length - 1]!)) s = s.slice(1, -1); return s; }
const Rs = R.join("");
const isRot = (w: string[]) => w.length === R.length && (Rs + Rs).includes(w.join(""));
const words: string[][] = [[]]; for (const p of letters) { words.push([p]); for (const q of letters) if (q !== inv(p)) words.push([p, q]); }
const edges = "abcdef".split("");
const opts = (e: string) => { const r: string[][] = []; for (const u of words) for (const v of words) { if (u.length + v.length === 0 || u.length + v.length > 3) continue; if (u.length && u[u.length-1] === inv(e)) continue; if (v.length && v[0] === inv(e)) continue; r.push([...u, e, ...v]); } return r; };
const found: string[] = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
  const x = edges[i]!, y = edges[j]!; const ox = opts(x), oy = opts(y);
  for (const ix of ox) for (const iy of oy) {
    const img = (c: string): string[] => { const l = c.toLowerCase(); const w = l === x ? ix : l === y ? iy : [l]; return c === l ? w : w.toReversed().map(inv); };
    if (isRot(cycReduce(R.flatMap(img)))) found.push(`${x} -> ${ix.join(" ")}, ${y} -> ${iy.join(" ")}`);
  }
}
const interesting = found.filter((f) => !/(\w) \1|(\w) (\w) \3/.test(f));
console.log(found.length, interesting.length); console.log(interesting.slice(0, 80).join("\n"));
