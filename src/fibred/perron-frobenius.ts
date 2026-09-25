/**
 * The growth rate and the train-track weights of a fibred surface: the Perron–Frobenius eigenvalue of the
 * transition matrix and its eigenvectors (the C# `FibredSurfaceTransitionMatrixAndWeights`).
 *
 * @module
 */
import { EigenvalueDecomposition, Matrix } from "ml-matrix";
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

/**
 * Computes the growth rate and the weights, for the whole graph or only for the essential subgraph H (the
 * edges not eventually mapped into the periphery).
 *
 * For a reducible transition matrix, the eigenvalue λ can be multiple, and the eigenvector is then some
 * vector of the eigenspace. Its entries that are negative or relatively tiny are set to 0 (the C# version
 * produced NaN in that case, port note 01, Q2).
 */
export function perronFrobenius(fs: FibredSurface, options: { essentialOnly: boolean }): PerronFrobeniusData {
  const essential = options.essentialOnly ? fs.essentialSubgraph() : undefined;
  const edges = fs.graph.edges.filter((e) => essential === undefined || essential.has(e));
  const matrix = fs.g.transitionMatrix(edges, edges);
  if (edges.length === 0) return { growth: 1, widths: new Map(), lengths: new Map(), matrix };

  const M = new Matrix(matrix.entries.map((row) => [...row]));
  const right = dominantEigenvector(M);
  const left = dominantEigenvector(M.transpose());
  const growth = right.eigenvalue;

  const widths = scaleToGeometricMean(right.vector, growth);
  const imageLengths = edges.map((e) => fs.g.image(e.forward).length);
  const ratios = left.vector.flatMap((l, i) => (l > 0 ? [(imageLengths[i] as number) / l] : []));
  const lengthScale = ratios.length > 0 ? geometricMean(ratios) : 1;
  const lengths = left.vector.map((l) => l * lengthScale);

  return {
    growth,
    widths: new Map(edges.map((e, i) => [e, widths[i] as number])),
    lengths: new Map(edges.map((e, i) => [e, lengths[i] as number])),
    matrix,
  };
}

/**
 * The largest real eigenvalue of a non-negative matrix and an eigenvector for it, with non-negative entries
 * (negative and relatively tiny entries set to 0).
 */
function dominantEigenvector(M: Matrix): { eigenvalue: number; vector: number[] } {
  const evd = new EigenvalueDecomposition(M);
  const eigenvalues = evd.realEigenvalues;
  let index = 0;
  eigenvalues.forEach((value, i) => {
    if (value > (eigenvalues[index] as number)) index = i;
  });
  let vector = evd.eigenvectorMatrix.getColumn(index);
  if (vector.reduce((a, b) => a + b, 0) < 0) vector = vector.map((x) => -x);
  const max = Math.max(...vector.map(Math.abs));
  vector = vector.map((x) => (x > ZERO_TOLERANCE * max ? x : 0));
  return { eigenvalue: eigenvalues[index] as number, vector };
}

/** Scales `vector` so that the geometric mean of its positive entries is `target`. */
function scaleToGeometricMean(vector: number[], target: number): number[] {
  const positive = vector.filter((x) => x > 0);
  if (positive.length === 0) return vector;
  const factor = target / geometricMean(positive);
  return vector.map((x) => x * factor);
}
