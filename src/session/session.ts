/**
 * A session: where it started, and the history of states as a tree whose edges are moves (the C# `FibredSurfaceMenu`
 * history graph, `AdjacencyGraph<MenuVertex, MenuEdge>`). Every node keeps its own copy of the fibred surface, so
 * going back and branching is free, and every move is plain data, so a session can be saved as its start plus its
 * moves and replayed.
 *
 * Plain TypeScript without UI code, so it runs in tests; the UI (`src/ui/`) displays it.
 *
 * @module
 */
import type { FibredSurface } from "../fibred/fibred-surface";
import { applyMove, type Move } from "../fibred/move";
import { autopilot, type AutopilotOptions, nextSuggestion, type Suggestion } from "../fibred/suggestions";
import { type FibredSurfaceOptions, initialFibredSurface, type SurfaceModel } from "../examples/models";
import { buildPreset, PRESETS, randomGenus2 } from "../examples/presets";

/** How a session starts: a preset, or a model with options and a map. Plain data (saved in files and links). */
export type Start =
  | { readonly kind: "preset"; readonly preset: string; readonly seed?: number }
  | {
      readonly kind: "model";
      readonly model: SurfaceModel;
      readonly options?: FibredSurfaceOptions;
      readonly map?: string;
    };

export interface HistoryNode {
  readonly id: number;
  readonly parent: HistoryNode | undefined;
  /** The move from the parent to this node (undefined for the root). */
  readonly move: Move | undefined;
  readonly children: HistoryNode[];
  /** The state after the move. Never changed afterwards: moves are applied to copies. */
  readonly surface: FibredSurface;
  /** The model to draw this state in (a closed-surface move replaces it by the ribbon graph of the new spine). */
  readonly model: SurfaceModel;
}

export class Session {
  readonly root: HistoryNode;
  current: HistoryNode;
  /** Increased on every change, so that the UI knows when to redraw. */
  version = 0;
  private nextId = 0;

  private constructor(
    readonly start: Start,
    surface: FibredSurface,
    model: SurfaceModel,
  ) {
    this.root = { id: this.nextId++, parent: undefined, move: undefined, children: [], surface, model };
    this.current = this.root;
  }

  /** @throws Error if the start is not a valid fibred surface (e.g. the map is not a homeomorphism). */
  static create(start: Start): Session {
    const { surface, model } = startSurface(start);
    const problems = surface.checkIntegrity();
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return new Session(start, surface, model);
  }

  /** The suggestion at the current state. */
  suggestion(): Suggestion {
    return nextSuggestion(this.current.surface);
  }

  /**
   * Applies a move to a copy of the current state and makes the result the current node. If the same move was
   * applied here before, that child is reused (the history is a tree, not a list).
   *
   * @throws Error if the move fails or leaves the surface inconsistent; the history doesn't change then.
   */
  apply(move: Move): HistoryNode {
    const key = JSON.stringify(move);
    const existing = this.current.children.find((c) => JSON.stringify(c.move) === key);
    if (existing !== undefined) return this.select(existing);
    const copy = this.current.surface.copy();
    copy.onError = () => {};
    const result = applyMove(copy, move);
    const problems = result.checkIntegrity();
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return this.select(this.addChild(this.current, move, result));
  }

  /**
   * Runs the autopilot from the current state; every step becomes a node (the "run ahead" buttons), and the last one
   * becomes current.
   */
  runAutopilot(options: Omit<AutopilotOptions, "onStep"> = {}): Suggestion {
    const copy = this.current.surface.copy();
    copy.onError = () => {};
    let node = this.current;
    const { stoppedAt } = autopilot(copy, {
      ...options,
      onStep: (move, surface) => {
        const existing = node.children.find((c) => JSON.stringify(c.move) === JSON.stringify(move));
        node = existing ?? this.addChild(node, move, surface.copy());
      },
    });
    this.select(node);
    return stoppedAt;
  }

  select(node: HistoryNode): HistoryNode {
    this.current = node;
    this.version++;
    return node;
  }

  /** The path of moves from the root to a node. */
  path(node: HistoryNode = this.current): HistoryNode[] {
    const result: HistoryNode[] = [];
    for (let n: HistoryNode | undefined = node; n !== undefined; n = n.parent) result.unshift(n);
    return result;
  }

  // ─── Saving ────────────────────────────────────────────────────────────────────────────────

  toFile(): SessionFile {
    const tree = (node: HistoryNode): SavedNode => ({
      ...(node.move && { move: node.move }),
      children: node.children.map(tree),
    });
    const current: number[] = [];
    for (let n = this.current; n.parent !== undefined; n = n.parent)
      current.unshift(n.parent.children.indexOf(n));
    return { format: FILE_FORMAT, version: FILE_VERSION, start: this.start, tree: tree(this.root), current };
  }

  /** Rebuilds a session by replaying its moves. Moves that fail now (e.g. after a program change) are skipped. */
  static fromFile(file: SessionFile): { session: Session; skipped: number } {
    if (file.format !== FILE_FORMAT) throw new Error("This is not a saved session");
    if (file.version > FILE_VERSION)
      throw new Error("This session was saved by a newer version of the program");
    const session = Session.create(file.start);
    let skipped = 0;
    const replay = (node: HistoryNode, saved: SavedNode): HistoryNode[] =>
      saved.children.map((child) => {
        session.current = node;
        try {
          const created = session.apply(child.move as Move);
          replay(created, child);
          return created;
        } catch {
          skipped++;
          return node;
        }
      });
    replay(session.root, file.tree);
    let current = session.root;
    for (const i of file.current) current = current.children[i] ?? current;
    session.select(current);
    return { session, skipped };
  }

  private addChild(parent: HistoryNode, move: Move, surface: FibredSurface): HistoryNode {
    const model = surface.spine0 === parent.surface.spine0 ? parent.model : ribbonModelOf(surface);
    const node: HistoryNode = { id: this.nextId++, parent, move, children: [], surface, model };
    parent.children.push(node);
    return node;
  }
}

export const FILE_FORMAT = "bestvina-handel-session";
export const FILE_VERSION = 1;

export interface SavedNode {
  readonly move?: Move;
  readonly children: readonly SavedNode[];
}

export interface SessionFile {
  readonly format: typeof FILE_FORMAT;
  readonly version: number;
  readonly start: Start;
  readonly tree: SavedNode;
  /** The current node, as child indices from the root. */
  readonly current: readonly number[];
}

/** The surface and model a start describes. */
export function startSurface(start: Start): { surface: FibredSurface; model: SurfaceModel } {
  if (start.kind === "preset") {
    const preset =
      start.preset === "Random mapping class in genus 2"
        ? randomGenus2(start.seed ?? 1)
        : PRESETS.find((p) => p.name === start.preset);
    if (preset === undefined) throw new Error(`There is no example "${start.preset}"`);
    return { surface: buildPreset(preset), model: preset.model };
  }
  const surface = initialFibredSurface(start.model, start.options);
  if (start.map !== undefined && start.map.trim() !== "")
    applyMove(surface, { kind: "edit map", text: start.map, mode: "replace" });
  return { surface, model: start.model };
}

/** The ribbon model of a surface's own spine G₀ (after a closed-surface move, which re-marks the surface). */
function ribbonModelOf(surface: FibredSurface): SurfaceModel {
  return {
    kind: "ribbon",
    name: "Ribbon graph",
    description: "The spine of the surface after replacing the puncture.",
    boundaryWords: surface.spine0.boundaryWords().map((w) => w.letters.map((x) => x.name)),
    closed: surface.isClosed && surface.spine0.boundaryWords().length === 1,
  };
}
