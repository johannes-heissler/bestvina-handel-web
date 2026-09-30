<!--
  The next step of the algorithm with its options (the C# suggestion menu) and, under the focused option, its further
  choices. "What will happen" shows what the selected move does, step by step, computed before it is applied (and
  used when it is), with a timeline to see each step in the views. After a step, the kinds ticked under "Automatic
  steps" follow by themselves (e.g. pulling tight). Going back and forth is in the history panel (`HistoryView`).
-->
<script lang="ts">
  import {
    combine,
    type MoveOption,
    type OptionalMove,
    type SuggestionKind,
    type Text,
    variants,
  } from "../fibred/suggestions";
  import type { FibredSurface } from "../fibred/fibred-surface";
  import type { Preview } from "../session/session";
  import type { Motion } from "../fibred/narration";
  import { describeMove } from "../session/describe";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  const KINDS: { kind: SuggestionKind; label: string }[] = [
    { kind: "collapse invariant subforest", label: "Collapse invariant forests" },
    { kind: "pull tight", label: "Pull tight" },
    { kind: "move vertices", label: "Moving vertices (least λ)" },
    { kind: "remove valence-2 junctions", label: "Valence-2 junctions" },
    { kind: "absorb into periphery", label: "Absorb into the periphery" },
    { kind: "fold", label: "Folds" },
    { kind: "closed surface", label: "Closed surfaces (cut)" },
    { kind: "reducible", label: "Reduce (first piece)" },
  ];

  const OPTIONAL: { move: OptionalMove; label: string; title: string }[] = [
    {
      move: "cut",
      label: "Cutting along a singular leaf (closed surfaces)",
      title: "The closed-surface move of the thesis: replace the puncture by the orbit of a singularity",
    },
    {
      move: "reduce",
      label: "Reductions",
      title: "Reducing along an invariant subgraph, and splitting junctions along the components of τ",
    },
    {
      move: "move vertices",
      label: "Moving vertices",
      title: "Moving the image of a junction along the first strip of some of its images, when that lowers λ",
    },
  ];

  const node = $derived.by(() => {
    void app.version;
    return app.session?.current;
  });
  const suggestion = $derived.by(() => {
    void app.version;
    try {
      return app.session?.suggestion();
    } catch (e) {
      app.error = String(e);
      return undefined;
    }
  });

  let selected = $state<number[]>([0]);
  /**
   * The option clicked last: its further choices are shown under it (also when several options are ticked). With one
   * option at a time, the options are headings that open their choices, and the first choice is selected.
   */
  let focused = $state(0);
  /** The choice selected under the focused option (undefined: the option itself, with its default choice). */
  let chosen = $state<number | undefined>(undefined);
  /** Whether the focused option is opened (clicking it again closes it; it stays selected). */
  let open = $state(true);
  $effect(() => {
    void suggestion;
    selected = [0];
    focused = 0;
    chosen = undefined;
    open = true;
  });
  // The further choices of the focused option (e.g. how to fold), computed after the panel is drawn: some need the
  // move to be tried on a copy.
  let choices = $state.raw<{ list?: MoveOption[]; error?: string } | undefined>(undefined);
  $effect(() => {
    const option = suggestion?.options[focused];
    const surface = node?.surface;
    choices = undefined;
    if (!option || !surface) return;
    const multiple = suggestion?.multiple;
    const timer = setTimeout(() => {
      try {
        const list = variants(surface, option.move);
        choices = { list };
        if (!multiple && list.length > 0) chosen = 0;
      } catch (e) {
        choices = { error: e instanceof Error ? e.message : String(e) };
      }
    }, 0);
    return () => clearTimeout(timer);
  });

  function toggle(i: number) {
    if (!suggestion?.multiple && i === focused) {
      open = !open; // (keeps its choice)
      return;
    }
    focused = i;
    open = true;
    chosen = undefined;
    if (!suggestion?.multiple) selected = [i];
    else selected = selected.includes(i) ? selected.filter((j) => j !== i) : [...selected, i];
  }

  /** The move that Apply would apply: the selected choice, or the selected options. */
  const selectedMove = $derived.by(() => {
    if (!suggestion || suggestion.options.length === 0) return undefined;
    // With one option at a time, wait for its choices: the first one is selected when they are there.
    if (!suggestion.multiple && choices === undefined) return undefined;
    const choice = chosen === undefined ? undefined : choices?.list?.[chosen];
    if (choice) return choice.move;
    const moves = selected.map((i) => suggestion.options[i]?.move).filter((m) => m !== undefined);
    try {
      return moves.length > 0 ? combine(moves) : undefined;
    } catch {
      return undefined;
    }
  });

  // What will happen: the selected move tried on a copy (with the automatic steps after it), after the panel is drawn.
  let preview = $state.raw<Preview | undefined>(undefined);
  $effect(() => {
    const move = selectedMove;
    const session = app.session;
    const automatic = new Set(app.automatic);
    preview = undefined;
    if (!move || !session) return;
    const timer = setTimeout(() => (preview = session.preview(move, automatic)), 0);
    return () => clearTimeout(timer);
  });

  // The timeline: position k shows the surface after the k-th step (0: before the move; undefined: not shown).
  interface Moment {
    readonly text: Text;
    readonly surface: FibredSurface;
    readonly motion?: Motion;
  }
  const moments = $derived<Moment[]>(
    preview?.surface === undefined
      ? []
      : [
          ...preview.steps.map((s) => ({ text: s.text, surface: s.after, ...(s.motion && { motion: s.motion }) })),
          ...preview.automatic.map((a) => ({ text: describeMove(a.move), surface: a.surface })),
        ],
  );
  let position = $state<number | undefined>(undefined);
  let playing = $state(false);
  $effect(() => {
    void preview;
    position = undefined;
    playing = false;
  });
  $effect(() => {
    // Show the state at the position in the views: after step k at k, and between two states in between (not for
    // moves that replace the surface's spine).
    const before = preview?.before;
    if (position === undefined || !before) {
      app.shown = undefined;
      return;
    }
    const states = [before, ...moments.map((m) => m.surface)];
    if (states.some((state) => state.spine0 !== before.spine0)) {
      app.shown = undefined;
      return;
    }
    app.shown = { states, motions: moments.map((m) => m.motion), position };
    return () => (app.shown = undefined);
  });
  // Playing: 1.2 seconds per step, smoothly.
  $effect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = (position ?? 0) + (now - last) / 1200;
      last = now;
      if (next >= moments.length) {
        position = moments.length;
        playing = false;
        return;
      }
      position = next;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
  function play() {
    if (playing) playing = false;
    else {
      if (position === undefined || position >= moments.length) position = 0;
      playing = true;
    }
  }

  function applySelected() {
    if (preview?.surface !== undefined) app.commit(preview);
    else if (selectedMove) app.apply(selectedMove, { thenAutomatic: true });
  }

  function toggleAutomatic(kind: SuggestionKind) {
    app.automatic = app.automatic.includes(kind) ? app.automatic.filter((k) => k !== kind) : [...app.automatic, kind];
  }
  function runToTheEnd() {
    app.runAutopilot(new Set(KINDS.map((k) => k.kind).filter((k) => k !== "reducible")));
  }
</script>

<section class="panel">
  <h2>{suggestion?.kind === "finished" ? "Result" : "Next step"}</h2>
  {#if suggestion}
    <p><TextView text={suggestion.description} /></p>
    {#if suggestion.options.length > 0}
      <ul class="options">
        {#each suggestion.options as option, i (i)}
          <li
            class:continues={typeof option.label[0] === "string" && option.label[0].startsWith("Next fold")}
            class:discouraged={option.discouraged}
            title={option.discouraged
              ? (option.warning ?? "Possible now, but the algorithm does this only at the end")
              : undefined}
          >
            {#if suggestion.multiple}
              <label>
                <input
                  type="checkbox"
                  name="option"
                  checked={selected.includes(i) && (i !== focused || chosen === undefined)}
                  onchange={() => toggle(i)}
                />
                <TextView text={option.label} />
              </label>
            {:else}
              <button
                class="option-head"
                class:open={i === focused}
                aria-expanded={i === focused && open}
                onclick={() => toggle(i)}
                ><span class="disclosure" aria-hidden="true">{i === focused && open ? "▾" : "▸"}</span>
                <TextView text={option.label} /></button
              >
            {/if}
            {#if option.details}<div class="hint option-details"><TextView text={option.details} /></div>{/if}
            {#if i === focused && (open || suggestion.multiple)}
              {#if option.warning}<div class="note option-warning">⚠ {option.warning}</div>{/if}
              {#if choices === undefined}
                <p class="note choices-note">Computing the choices…</p>
              {:else if choices.error !== undefined}
                <p class="note choices-note">This option can't be applied here: {choices.error}</p>
              {:else if choices.list?.length}
                <ul class="choices">
                  {#each choices.list as choice, j (j)}
                    <li>
                      <label>
                        <input type="radio" name="choice" checked={chosen === j} onchange={() => (chosen = j)} />
                        <TextView text={choice.label} />
                      </label>
                      {#if choice.ratingText !== undefined}<span
                          class="rating"
                          title="side crossings of all strips after the fold">{choice.ratingText}</span
                        >{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if suggestion?.options.length || suggestion?.kind !== "finished"}
    <div class="buttons">
      {#if suggestion?.options.length}<button class="primary" onclick={applySelected}>Apply</button>{/if}
      {#if suggestion?.kind !== "finished"}
        <button onclick={runToTheEnd} title="Apply the default of every step until the algorithm stops">Run to the end</button>
      {/if}
    </div>
  {/if}

  <details class="automatic">
    <summary>Options</summary>
    <h4>Automatic steps ({app.automatic.length})</h4>
    <p class="hint">After each step you apply, steps of these kinds are done automatically; each is kept in the history.</p>
    <div class="checklist">
      {#each KINDS as { kind, label } (kind)}
        <label><input type="checkbox" checked={app.automatic.includes(kind)} onchange={() => toggleAutomatic(kind)} /> {label}</label>
      {/each}
    </div>
    <h4>Moves beyond the original algorithm</h4>
    <p class="hint">Switched off, their options are greyed out and never applied automatically.</p>
    <div class="checklist">
      {#each OPTIONAL as { move, label, title } (move)}
        <label {title}><input type="checkbox" checked={!app.disabled.includes(move)} onchange={() => app.toggleMove(move)} /> {label}</label>
      {/each}
    </div>
  </details>

  {#if suggestion?.options.length}
    <div class="will-happen-block">
    <h3>What will happen</h3>
    {#if preview === undefined}
      <p class="note">Computing…</p>
    {:else if preview.error !== undefined}
      <p class="note">This can't be applied here: {preview.error}</p>
    {:else}
      <!-- (A short horizontal slider in a row that stays in sight: a slider as tall as the list scrolled the panel.) -->
      <div class="timeline-controls">
        <button onclick={play} title="Show the steps one after the other in the views">{playing ? "⏸" : "▶"}</button>
        <input
          class="timeline"
          type="range"
          min="0"
          max={moments.length}
          step="any"
          value={position ?? 0}
          aria-label="Timeline of the steps"
          oninput={(event) => {
            playing = false;
            position = Number((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <span class="hint step-count"
          >{position === undefined
            ? "Click a step to see it"
            : `Step ${Math.min(moments.length, Math.floor(position) + (position % 1 > 0 ? 1 : 0))} of ${moments.length}`}</span
        >
        <button
          class="link"
          disabled={position === undefined}
          onclick={() => {
            position = undefined;
            playing = false;
          }}>Now</button
        >
      </div>
      <ol class="will-happen">
        {#each moments as moment, k (k)}
          <li
            class:automatic-step={k >= preview.steps.length}
            class:pending={position !== undefined && position <= k}
            class:now={position !== undefined && position > k && position <= k + 1}
          >
            <button
              class="step"
              title="Show the state after this step"
              onclick={() => {
                playing = false;
                position = k + 1;
              }}><TextView text={moment.text} surface={preview.before} /></button
            >
          </li>
        {/each}
      </ol>
      <p class="hint">
        {#if preview.automatic.length > 0}Steps {preview.steps.length + 1}–{moments.length} are the automatic steps after it.
        {/if}Afterwards: {preview.growth === undefined ? "the growth can't be computed" : `growth λ = ${preview.growth.toFixed(6)}`}
        <span class="timing">({preview.time.toFixed(0)} ms)</span>
      </p>
    {/if}
    </div>
  {/if}
</section>
