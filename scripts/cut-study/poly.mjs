// Exact characteristic polynomials of transition matrices: `node poly.mjs <matrix.json> [λ]`, or import.
// Computed modulo enough primes (Hessenberg reduction) and recovered by CRT; then x^k and cyclotomic factors are divided
// out, leaving the part that carries the growth λ.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Primes just below 2^26 (products stay below 2^53). */
function primes(count) {
  const result = [];
  for (let p = (1 << 26) - 1; result.length < count; p -= 2) {
    let prime = true;
    for (let d = 3; d * d <= p; d += 2) if (p % d === 0) { prime = false; break; }
    if (prime) result.push(p);
  }
  return result;
}

const mod = (a, p) => ((a % p) + p) % p;
function inv(a, p) {
  let [r0, r1, s0, s1] = [mod(a, p), p, 1, 0];
  while (r1 !== 0) { const q = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  return mod(s0, p);
}
const mulmod = (a, b, p) => Number((BigInt(a) * BigInt(b)) % BigInt(p));

/** det(xI − M) mod p, coefficients from x^0 to x^n, via reduction to Hessenberg form. */
function charpolyMod(M, p) {
  const n = M.length;
  const H = M.map((r) => r.map((x) => mod(x, p)));
  for (let m = 1; m < n - 1; m++) {
    let i = m;
    while (i < n && H[i][m - 1] === 0) i++;
    if (i === n) continue;
    if (i !== m) {
      [H[i], H[m]] = [H[m], H[i]];
      for (const row of H) [row[i], row[m]] = [row[m], row[i]];
    }
    const pivotInv = inv(H[m][m - 1], p);
    for (let r = m + 1; r < n; r++) {
      const u = mulmod(H[r][m - 1], pivotInv, p);
      if (u === 0) continue;
      for (let c = 0; c < n; c++) H[r][c] = mod(H[r][c] - mulmod(u, H[m][c], p), p);
      for (let row = 0; row < n; row++) H[row][m] = mod(H[row][m] + mulmod(u, H[row][r], p), p);
    }
  }
  // c_k(x) = char poly of the leading k×k block, by the Hessenberg recurrence.
  let polys = [[1]];
  for (let k = 1; k <= n; k++) {
    const prev = polys[k - 1];
    const next = new Array(k + 1).fill(0);
    for (let i = 0; i < prev.length; i++) { next[i + 1] = mod(next[i + 1] + prev[i], p); next[i] = mod(next[i] - mulmod(H[k - 1][k - 1], prev[i], p), p); }
    let t = 1;
    for (let i = 1; i < k; i++) {
      t = mulmod(t, H[k - i][k - i - 1], p);
      const coef = mulmod(t, H[k - i - 1][k - 1], p);
      if (coef === 0) continue;
      const q = polys[k - i - 1];
      for (let j = 0; j < q.length; j++) next[j] = mod(next[j] - mulmod(coef, q[j], p), p);
    }
    polys.push(next);
  }
  return polys[n];
}

/** The exact characteristic polynomial (BigInt coefficients, x^0 first). */
export function charpoly(M) {
  const n = M.length;
  // |c_k| ≤ ∏ (1 + column 1-norm), so twice that in bits, plus margin.
  let bits = 2;
  for (let j = 0; j < n; j++) bits += Math.log2(1 + M.reduce((s, r) => s + Math.abs(r[j]), 0));
  const ps = primes(Math.ceil((bits + 2) / 25) + 1);
  let modulus = 1n;
  let coeffs = new Array(n + 1).fill(0n);
  for (const p of ps) {
    const c = charpolyMod(M, p);
    const P = BigInt(p);
    // CRT: x ≡ coeffs (mod modulus), x ≡ c (mod p).
    const mInv = BigInt(inv(Number(modulus % P), p));
    coeffs = coeffs.map((a, i) => {
      const t = ((((BigInt(c[i]) - a) % P) + P) % P) * mInv % P;
      return a + modulus * t;
    });
    modulus *= P;
  }
  const half = modulus / 2n;
  return coeffs.map((a) => (a > half ? a - modulus : a));
}

// ─── Polynomial arithmetic over ℤ (x^0 first) ──────────────────────────────────────────────
const trim = (a) => { const b = [...a]; while (b.length > 1 && b[b.length - 1] === 0n) b.pop(); return b; };
function divmod(a, b) {
  a = trim(a); b = trim(b);
  const q = new Array(Math.max(1, a.length - b.length + 1)).fill(0n);
  const r = [...a];
  const lead = b[b.length - 1];
  for (let i = a.length - b.length; i >= 0; i--) {
    const c = r[i + b.length - 1];
    if (c % lead !== 0n) return undefined;
    const f = c / lead;
    q[i] = f;
    for (let j = 0; j < b.length; j++) r[i + j] -= f * b[j];
  }
  return { q: trim(q), r: trim(r) };
}
const isZero = (a) => trim(a).every((x) => x === 0n);
function mulPoly(a, b) { const c = new Array(a.length + b.length - 1).fill(0n); a.forEach((x, i) => b.forEach((y, j) => (c[i + j] += x * y))); return c; }

const cyclotomic = new Map();
export function phi(m) {
  if (cyclotomic.has(m)) return cyclotomic.get(m);
  let p = new Array(m + 1).fill(0n); p[0] = -1n; p[m] = 1n;
  for (let d = 1; d < m; d++) if (m % d === 0) p = divmod(p, phi(d)).q;
  cyclotomic.set(m, p);
  return p;
}

/** Splits off x^k and cyclotomic factors Φ_m (m ≤ maxM): { x, cyclo: {m: multiplicity}, rest }. */
export function strip(poly, maxM = 400) {
  let p = trim(poly);
  let x = 0;
  while (p.length > 1 && p[0] === 0n) { p = p.slice(1); x++; }
  const cyclo = {};
  for (let m = 1; m <= maxM; m++) {
    const f = phi(m);
    if (f.length > p.length) continue;
    for (;;) {
      const d = divmod(p, f);
      if (!d || !isZero(d.r)) break;
      p = d.q;
      cyclo[m] = (cyclo[m] ?? 0) + 1;
    }
  }
  return { x, cyclo, rest: p };
}

export const evalAt = (p, x) => p.reduceRight((s, c) => s * x + Number(c), 0);
export function show(p) {
  const terms = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === 0n) continue;
    const abs = c < 0n ? -c : c;
    const sign = c < 0n ? "−" : "+";
    const mono = i === 0 ? "" : i === 1 ? "x" : `x^${i}`;
    terms.push(`${sign} ${abs === 1n && i > 0 ? "" : abs}${mono}`);
  }
  return terms.join(" ").replace(/^\+ /, "").replace(/^− /, "−");
}
export const isReciprocal = (p) => { const t = trim(p); return t.every((c, i) => c === t[t.length - 1 - i]) ? "reciprocal" : t.every((c, i) => c === -t[t.length - 1 - i]) ? "anti-reciprocal" : "no"; };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { M } = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const cp = charpoly(M);
  const { x, cyclo, rest } = strip(cp);
  console.log(JSON.stringify({ n: M.length, x, cyclo, restDegree: rest.length - 1, reciprocal: isReciprocal(rest), rest: show(rest) }));
  if (process.argv[3]) console.log("rest(λ) =", evalAt(rest, Number(process.argv[3])));
}
