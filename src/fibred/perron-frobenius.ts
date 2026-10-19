/**
 * The growth rate and the train-track weights of a fibred surface: the Perron–Frobenius eigenvalue of the
 * transition matrix and its eigenvectors (the C# `FibredSurfaceTransitionMatrixAndWeights`).
 *
 * Without a full eigen-decomposition (port note 08, update): λ by power iteration on the strongly connected components,
 * the eigenvectors by inverse iteration. Both always converge for a non-negative matrix.
 *
 * @module
 */
import { LuDecomposition, Matrix } from "ml-matrix";
import type { Edge } from "../graph/ribbon-graph";
import type { TransitionMatrix } from "../graph/transition-matrix";
import { geometricMean } from "../util/number";
import type { FibredSurface } from "./fibred-surface";

/** The result of {@link perronFrobenius}. */
export interface PerronFrobeniusData {
  /** The growth rate λ: the largest real eigenvalue (= spectral radius) of the transition matrix. */
  readonly growth: number;
  /**
   * Widths of the strips: an eigenvector M w = λ w (for the transition matrix M, whose column e counts the
   * letters of g(e)). Scaled so that the geometric mean of the positive widths is λ, as in C#.
   */
  readonly widths: ReadonlyMap<Edge, number>;
  /**
   * Lengths of the strips: an eigenvector l M = λ l, so that the length of g(e) is λ times the length of e.
   * Scaled so that the lengths are comparable with the image lengths |g(e)| (the geometric mean of |g(e)| / l(e)
   * over the edges with positive length is 1), as in C#.
   */
  readonly lengths: ReadonlyMap<Edge, number>;
  readonly matrix: TransitionMatrix;
}

/** Relative size below which eigenvector entries count as zero. */
const ZERO_TOLERANCE = 1e-12;

/** The transition matrix of all strips, or only of the essential subgraph H (the edges not eventually mapped into P). */
function transitionMatrixOf(
  fs: FibredSurface,
  essentialOnly: boolean,
): { edges: Edge[]; matrix: TransitionMatrix } {
  const essential = essentialOnly ? fs.essentialSubgraph() : undefined;
  const edges = fs.graph.edges.filter((e) => essential === undefined || essential.has(e));
  return { edges, matrix: fs.g.transitionMatrix(edges, edges) };
}

/** The growth rate λ alone (see {@link perronFrobenius}): much faster, for comparing candidate moves. */
export function growthRate(fs: FibredSurface, options: { essentialOnly: boolean }): number {
  const { edges, matrix } = transitionMatrixOf(fs, options.essentialOnly);
  return edges.length === 0 ? 1 : spectralRadius(matrix.entries);
}

/**
 * Computes the growth rate and the weights, for the whole graph or only for the essential subgraph H (the
 * edges not eventually mapped into the periphery).
 *
 * For a reducible transition matrix, the eigenvalue λ can be multiple, and the eigenvector is then some
 * non-negative vector of the eigenspace. Its entries that are relatively tiny are set to 0 (the C# version
 * produced NaN in that case, port note 01, Q2).
 */
export function perronFrobenius(fs: FibredSurface, options: { essentialOnly: boolean }): PerronFrobeniusData {
  const { edges, matrix } = transitionMatrixOf(fs, options.essentialOnly);
  if (edges.length === 0) return { growth: 1, widths: new Map(), lengths: new Map(), matrix };

  const M = matrix.entries;
  const growth = spectralRadius(M);
  const right = perronVector(M, growth);
  const left = perronVector(transpose(M), growth);

  const widths = scaleToGeometricMean(right, growth);
  const imageLengths = edges.map((e) => fs.g.image(e.forward).length);
  const ratios = left.flatMap((l, i) => (l > 0 ? [(imageLengths[i] as number) / l] : []));
  const lengthScale = ratios.length > 0 ? geometricMean(ratios) : 1;
  const lengths = left.map((l) => l * lengthScale);

  return {
    growth,
    widths: new Map(edges.map((e, i) => [e, widths[i] as number])),
    lengths: new Map(edges.map((e, i) => [e, lengths[i] as number])),
    matrix,
  };
}

/**
 * The spectral radius of a non-negative matrix: the largest spectral radius of the diagonal blocks of its strongly
 * connected components. Each block B is irreducible, so B + I is primitive, and the power iteration with B + I
 * converges; it stops when the Collatz–Wielandt bounds min (Bx)ᵢ/xᵢ ≤ ρ(B) ≤ max (Bx)ᵢ/xᵢ agree.
 */
export function spectralRadius(M: readonly (readonly number[])[]): number {
  let radius = 0;
  for (const component of stronglyConnectedComponents(M)) {
    if (component.length === 1) {
      const i = component[0] as number;
      radius = Math.max(radius, (M[i] as readonly number[])[i] as number);
      continue;
    }
    // The block as a sparse list of its entries (local indices).
    const entries: [number, number, number][] = [];
    component.forEach((i, row) =>
      component.forEach((j, column) => {
        const value = (M[i] as readonly number[])[j] as number;
        if (value !== 0) entries.push([row, column, value]);
      }),
    );
    const n = component.length;
    let x = new Array<number>(n).fill(1);
    let low = 0;
    let high = Infinity;
    for (let step = 0; step < 1_000_000; step++) {
      const y = [...x]; // (B + I) x
      for (const [row, column, value] of entries) y[row] = (y[row] as number) + value * (x[column] as number);
      [low, high] = [Infinity, 0];
      y.forEach((value, i) => {
        const ratio = value / (x[i] as number);
        low = Math.min(low, ratio);
        high = Math.max(high, ratio);
      });
      if (high - low <= 1e-13 * high) break;
      const max = Math.max(...y);
      x = y.map((value) => value / max);
    }
    radius = Math.max(radius, (low + high) / 2 - 1);
  }
  return radius;
}

/**
 * A non-negative eigenvector of the non-negative matrix M for its spectral radius λ, by inverse iteration with a shift
 * just above λ: (λ′ I − M)⁻¹ = Σ Mᵏ / λ′ᵏ⁺¹ is non-negative and amplifies the eigenspace of λ (also a Jordan block)
 * by about 1/(λ′ − λ). Relatively tiny entries are set to 0.
 */
function perronVector(M: readonly (readonly number[])[], λ: number): number[] {
  const n = M.length;
  const shift = λ + 1e-9 * Math.max(λ, 1);
  const A = new Matrix(M.map((row, i) => row.map((value, j) => (i === j ? shift : 0) - value)));
  const lu = new LuDecomposition(A);
  let x = new Array<number>(n).fill(1);
  for (let step = 0; step < 6; step++) {
    const y = lu.solve(Matrix.columnVector(x)).getColumn(0);
    const max = Math.max(...y.map(Math.abs));
    if (!Number.isFinite(max) || max === 0) break;
    x = y.map((value) => value / max);
  }
  const max = Math.max(...x.map(Math.abs));
  return x.map((value) => (value > ZERO_TOLERANCE * max ? value : 0));
}

/** The strongly connected components of the graph with an arrow j → i when M[i][j] > 0 (Tarjan's algorithm). */
function stronglyConnectedComponents(M: readonly (readonly number[])[]): number[][] {
  const n = M.length;
  const successors = Array.from({ length: n }, (_, j) =>
    M.flatMap((row, i) => (((row as readonly number[])[j] as number) > 0 ? [i] : [])),
  );
  const index = new Array<number>(n).fill(-1);
  const lowLink = new Array<number>(n).fill(0);
  const onStack = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  const components: number[][] = [];
  let counter = 0;
  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    // An explicit stack of (vertex, next successor to look at), instead of recursion.
    const work: [number, number][] = [[root, 0]];
    index[root] = lowLink[root] = counter++;
    stack.push(root);
    onStack[root] = true;
    while (work.length > 0) {
      const top = work[work.length - 1] as [number, number];
      const [v, next] = top;
      const succ = successors[v] as number[];
      if (next < succ.length) {
        top[1]++;
        const w = succ[next] as number;
        if (index[w] === -1) {
          index[w] = lowLink[w] = counter++;
          stack.push(w);
          onStack[w] = true;
          work.push([w, 0]);
        } else if (onStack[w]) lowLink[v] = Math.min(lowLink[v] as number, index[w] as number);
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined)
        lowLink[parent[0]] = Math.min(lowLink[parent[0]] as number, lowLink[v] as number);
      if (lowLink[v] === index[v]) {
        const component: number[] = [];
        let w: number;
        do {
          w = stack.pop() as number;
          onStack[w] = false;
          component.push(w);
        } while (w !== v);
        components.push(component);
      }
    }
  }
  return components;
}

function transpose(M: readonly (readonly number[])[]): number[][] {
  return M.map((_, i) => M.map((row) => (row as readonly number[])[i] as number));
}

/** Scales `vector` so that the geometric mean of its positive entries is `target`. */
function scaleToGeometricMean(vector: number[], target: number): number[] {
  const positive = vector.filter((x) => x > 0);
  if (positive.length === 0) return vector;
  const factor = target / geometricMean(positive);
  return vector.map((x) => x * factor);
}
