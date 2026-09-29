/**
 * The app state: the session and what the views share (the hovered strip, the autopilot settings, errors). The
 * session is a plain class; `version` is bumped after every change so that the components re-read it.
 *
 * @module
 */
import type { FibredSurface } from "../fibred/fibred-surface";
import type { Move } from "../fibred/move";
import type { Motion } from "../fibred/narration";
import type { SuggestionKind } from "../fibred/suggestions";
import { type HistoryNode, type Preview, Session, type SessionFile, type Start } from "../session/session";
import { encodeSession } from "../session/share";
import { store } from "./storage";

export const AUTOSAVE_KEY = "last-session";

export class AppState {
  session = $state.raw<Session | undefined>(undefined);
  version = $state(0);
  /** The strip under the mouse in any view; all views highlight it. */
  hovered = $state<string | undefined>(undefined);
  error = $state<string | undefined>(undefined);
  message = $state<string | undefined>(undefined);
  showStart = $state(false);
  busy = $state(false);
  /**
   * The kinds of steps that are done automatically after each step the user applies (your semi-automatic mode). By
   * default the bookkeeping steps; the folds, reductions and closed-surface cuts are left to the user.
   */
  automatic = $state<SuggestionKind[]>([
    "collapse invariant subforest",
    "pull tight",
    "remove valence-1 junction",
    "remove valence-2 junctions",
    "absorb into periphery",
  ]);
  /** Whether the panel with the algorithm is on the left. */
  sidebarLeft = $state(false);

  start(start: Start): void {
    this.run(() => {
      this.session = Session.create(start);
      this.showStart = false;
    });
  }

  open(file: SessionFile): void {
    this.run(() => {
      const { session, skipped } = Session.fromFile(file);
      this.session = session;
      this.showStart = false;
      if (skipped > 0)
        this.message = `${skipped} saved moves couldn't be replayed with this version and were left out.`;
    });
  }

  /**
   * A surface to show in the views instead of the current one (a step of a move on the timeline of "What will
   * happen"); undefined shows the current state.
   */
  shown = $state.raw<Shown | undefined>(undefined);

  /** Applies a move; with `thenAutomatic`, the automatic kinds follow (see {@link automatic}). */
  apply(move: Move, options: { thenAutomatic?: boolean } = {}): void {
    this.run(() => {
      const session = this.session;
      if (session === undefined) return;
      session.commit(session.preview(move, options.thenAutomatic ? new Set(this.automatic) : new Set()));
    });
  }

  /** Applies a move that was previewed (with the automatic steps it included). */
  commit(preview: Preview): void {
    this.run(() => this.session?.commit(preview));
  }

  select(node: HistoryNode): void {
    this.run(() => this.session?.select(node));
  }

  runAutopilot(automatic: ReadonlySet<SuggestionKind> = new Set(this.automatic)): void {
    this.run(() => {
      const stopped = this.session?.runAutopilot({ automatic });
      if (stopped && stopped.kind !== "finished") this.message = `The autopilot stopped: ${stopped.kind}.`;
    });
  }

  /** Runs an action, shows its error, and saves afterwards. */
  private run(action: () => void): void {
    this.error = undefined;
    this.message = undefined;
    try {
      action();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.version++;
    void this.autosave();
  }

  /** Saves the session in the browser and in the address (a convenience: failures are ignored). */
  private async autosave(): Promise<void> {
    const session = this.session;
    if (session === undefined) return;
    try {
      const file = session.toFile();
      await store(AUTOSAVE_KEY, file);
      history.replaceState(null, "", `#${await encodeSession(file)}`);
    } catch {
      // e.g. no IndexedDB or compression streams (tests), or a very long address
    }
  }
}

export const app = new AppState();

/** What the views show instead of the current state: a surface, or a moment between two (see `drawBetween`). */
export type Shown =
  | { readonly surface: FibredSurface }
  | {
      readonly states: readonly FibredSurface[];
      readonly motions: readonly (Motion | undefined)[];
      readonly position: number;
    };
