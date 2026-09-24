/**
 * Small numeric helpers that JavaScript's `Math` lacks.
 *
 * @module
 */

/** Default absolute tolerance for comparing floating-point results (see port note 01, Q3). */
export const DEFAULT_TOLERANCE = 1e-3;

/** Whether `a` and `b` differ by less than `tolerance` (absolute). */
export function approxEqual(a: number, b: number, tolerance = DEFAULT_TOLERANCE): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * The mathematical remainder of `a` modulo `n`, always in `[0, n)` for positive `n`.
 * Unlike `%`, which keeps the sign of `a`: `-1 % 3 === -1`, but `mod(-1, 3) === 2`.
 */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** `x` restricted to the interval `[min, max]`. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

/** Linear interpolation: `a` at `t = 0`, `b` at `t = 1`. `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Greatest common divisor of two integers; always non-negative, and `gcd(0, 0) === 0`. */
export function gcd(a: number, b: number): number {
  assertSafeInteger(a, "gcd");
  assertSafeInteger(b, "gcd");
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

/**
 * Least common multiple of two positive integers.
 *
 * @throws RangeError if an argument is not a positive integer, or if the result exceeds
 *   `Number.MAX_SAFE_INTEGER` (where integer arithmetic on `number` stops being exact).
 */
export function lcm(a: number, b: number): number {
  if (!(a > 0 && b > 0)) throw new RangeError(`lcm expects positive integers, got ${a} and ${b}`);
  const result = (a / gcd(a, b)) * b;
  if (!Number.isSafeInteger(result))
    throw new RangeError(`lcm(${a}, ${b}) is too large to represent exactly`);
  return result;
}

/**
 * Geometric mean (x₁ ⋯ xₙ)^(1/n) of positive numbers, computed via logarithms to avoid overflow.
 *
 * @throws RangeError for an empty input or a value that is not positive. Callers that may have zero
 *   or slightly negative entries (e.g. numerically computed eigenvectors) must decide explicitly how to
 *   treat them. The C# version silently produced NaN in that case (port note 01).
 */
export function geometricMean(values: Iterable<number>): number {
  let logSum = 0;
  let count = 0;
  for (const value of values) {
    if (!(value > 0)) throw new RangeError(`geometricMean expects positive values, got ${value}`);
    logSum += Math.log(value);
    count++;
  }
  if (count === 0) throw new RangeError("geometricMean of an empty sequence");
  return Math.exp(logSum / count);
}

function assertSafeInteger(x: number, functionName: string): void {
  if (!Number.isSafeInteger(x)) throw new RangeError(`${functionName} expects integers, got ${x}`);
}
