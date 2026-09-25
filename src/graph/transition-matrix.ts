/**
 * Transition matrices of combinatorial maps.
 *
 * @module
 */
import type { Edge } from "./ribbon-graph";

/**
 * A matrix with rows and columns indexed by edges. For a combinatorial map g, the entry in row e′ and column
 * e is how often g(e) crosses e′ (in either direction). Square for g : G → G, non-square for μ : G → G₀.
 *
 * Replaces the nested dictionaries of the C# `TransitionMatrix`; the dense `entries` are ready for
 * eigenvalue computations.
 */
export class TransitionMatrix {
  private readonly rowIndex: Map<Edge, number>;
  private readonly columnIndex: Map<Edge, number>;

  constructor(
    readonly rows: readonly Edge[],
    readonly columns: readonly Edge[],
    /** `entries[i][j]` is the entry in row `rows[i]` and column `columns[j]`. */
    readonly entries: readonly (readonly number[])[],
  ) {
    this.rowIndex = new Map(rows.map((e, i) => [e, i]));
    this.columnIndex = new Map(columns.map((e, j) => [e, j]));
  }

  /** The entry in row `row` and column `column`. */
  get(row: Edge, column: Edge): number {
    const i = this.rowIndex.get(row);
    const j = this.columnIndex.get(column);
    if (i === undefined || j === undefined) throw new Error(`No entry for (${row}, ${column})`);
    return (this.entries[i] as number[])[j] as number;
  }

  /** The sum of all entries. For μ this is the total number of side crossings. */
  get total(): number {
    return this.entries.flat().reduce((a, b) => a + b, 0);
  }

  toString(): string {
    const header = ["", ...this.columns.map(String)].join("\t");
    const lines = this.rows.map((e, i) => [String(e), ...(this.entries[i] as number[])].join("\t"));
    return [header, ...lines].join("\n");
  }
}
