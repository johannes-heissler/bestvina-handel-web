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
import { applyMove, type FollowUp, type Move } from "../fibred/move";
import {
  autopilot,
  type AutopilotOptions,
  nextSuggestion,
  type Suggestion,
  type SuggestionKind,
  type Text,
} from "../fibred/suggestions";
import { perronFrobenius } from "../fibred/perron-frobenius";
import { narrated } from "../fibred/narration";
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
  /**
   * After a fold step (and the automatic steps after it): the inefficiency it followed and the strips of its next
   * fold, so that this fold is suggested first.
   */
  readonly followUp?: FollowUp;
  /** What the move did, step by step (subdivisions, isotopies, folds, …); empty if it doesn't say. */
  readonly steps?: readonly Text[];
}

/** One step of a move shown step by step: its explanation and the surface after it. */
export interface PreviewStep {
  readonly text: Text;
  readonly after: FibredSurface;
}

/**
 * What a move will do, computed on a copy before it is applied (and then used when it is): its explanation with the
 * surface after each step, the automatic steps after it, and the growth at the end.
 */
export interface Preview {
  readonly move: Move;
  /** The surface before the move. */
  readonly before: FibredSurface;
  readonly steps: readonly PreviewStep[];
  /** The surface after the move (undefined if it failed). */
  readonly surface?: FibredSurface;
  readonly followUp?: FollowUp;
  /** The automatic steps after the move: each move, its explanation and the surface after it. */
  readonly automatic: readonly { move: Move; steps: readonly Text[]; surface: FibredSurface }[];
  /** The growth of g after the move and the automatic steps (undefined if it can't be computed). */
  readonly growth?: number;
  /** Why the move can't be applied. */
  readonly error?: string;
  /** How long computing the preview took (ms). */
  readonly time: number;
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
    return nextSuggestion(this.current.surface, { followUp: this.current.followUp });
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
    const hint: { followUp?: FollowUp } = {};
    const { result, steps } = narrated(() =>
      applyMove(copy, move, { followUp: (point) => (hint.followUp = point) }),
    );
    const problems = result.checkIntegrity();
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return this.select(this.addChild(this.current, move, result, hint.followUp, steps));
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
      ...(this.current.followUp && { followUp: this.current.followUp }),
      onStep: (move, surface, steps) => {
        const existing = node.children.find((c) => JSON.stringify(c.move) === JSON.stringify(move));
        // Bookkeeping steps keep the hint of the fold before them (the strips of the next fold keep their names).
        const keep = move.kind === "fold" || move.kind === "remove inefficiency" ? undefined : node.followUp;
        node = existing ?? this.addChild(node, move, surface.copy(), keep, steps);
      },
    });
    this.select(node);
    return stoppedAt;
  }

  private readonly previews = new WeakMap<HistoryNode, Map<string, Preview>>();

  /**
   * What `move` will do from the current state (computed once per state, move and automatic kinds): applied to a
   * copy, with its explanation and the states in between, then the automatic steps (at most 50).
   */
  preview(move: Move, automatic: ReadonlySet<SuggestionKind> = new Set()): Preview {
    const node = this.current;
    const key = JSON.stringify([move, [...automatic].sort()]);
    let byKey = this.previews.get(node);
    if (byKey === undefined) this.previews.set(node, (byKey = new Map()));
    const cached = byKey.get(key);
    if (cached !== undefined) return cached;
    const started = performance.now();
    let preview: Preview;
    try {
      const copy = node.surface.copy();
      copy.onError = () => {};
      const hint: { followUp?: FollowUp } = {};
      const { result, narrated: told } = narrated(
        () => applyMove(copy, move, { followUp: (point) => (hint.followUp = point) }),
        { states: true },
      );
      const problems = result.checkIntegrity();
      if (problems.length > 0) throw new Error(problems.join("\n"));
      // The surface after step k is the one before step k + 1, and the result after the last step.
      const steps = told.map((step, k) => ({
        text: step.text,
        after: (told[k + 1]?.before ?? result) as FibredSurface,
      }));
      const auto: { move: Move; steps: readonly Text[]; surface: FibredSurface }[] = [];
      if (automatic.size > 0) {
        const start = result.copy();
        start.onError = () => {};
        autopilot(start, {
          automatic,
          maxSteps: 50,
          ...(hint.followUp && { followUp: hint.followUp }),
          onStep: (m, surface, texts) => auto.push({ move: m, steps: texts, surface: surface.copy() }),
        });
      }
      let growth: number | undefined;
      try {
        growth = perronFrobenius(auto.at(-1)?.surface ?? result, { essentialOnly: true }).growth;
      } catch {
        growth = undefined;
      }
      preview = {
        move,
        before: node.surface,
        steps,
        surface: result,
        ...(hint.followUp && { followUp: hint.followUp }),
        automatic: auto,
        ...(growth !== undefined && { growth }),
        time: performance.now() - started,
      };
    } catch (e) {
      preview = {
        move,
        before: node.surface,
        steps: [],
        automatic: [],
        error: e instanceof Error ? e.message : String(e),
        time: performance.now() - started,
      };
    }
    byKey.set(key, preview);
    return preview;
  }

  /**
   * Applies a previewed move: its result becomes a node of the history (or the existing one with the same move), then
   * the automatic steps after it; the last one becomes current.
   *
   * @throws Error if the move can't be applied (`preview.error`).
   */
  commit(preview: Preview): HistoryNode {
    if (preview.surface === undefined) throw new Error(preview.error ?? "The move can't be applied");
    const parent = this.current;
    const key = JSON.stringify(preview.move);
    let node =
      parent.children.find((c) => JSON.stringify(c.move) === key) ??
      this.addChild(
        parent,
        preview.move,
        preview.surface,
        preview.followUp,
        preview.steps.map((s) => s.text),
      );
    for (const step of preview.automatic) {
      const existing = node.children.find((c) => JSON.stringify(c.move) === JSON.stringify(step.move));
      // Bookkeeping steps keep the hint of the fold before them (the strips of the next fold keep their names).
      const keep =
        step.move.kind === "fold" || step.move.kind === "remove inefficiency" ? undefined : node.followUp;
      node = existing ?? this.addChild(node, step.move, step.surface, keep, step.steps);
    }
    return this.select(node);
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

  private addChild(
    parent: HistoryNode,
    move: Move,
    surface: FibredSurface,
    followUp?: FollowUp,
    steps?: readonly Text[],
  ): HistoryNode {
    const model = surface.spine0 === parent.surface.spine0 ? parent.model : ribbonModelOf(surface);
    const node: HistoryNode = {
      id: this.nextId++,
      parent,
      move,
      children: [],
      surface,
      model,
      ...(followUp && { followUp }),
      ...(steps && steps.length > 0 && { steps }),
    };
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
