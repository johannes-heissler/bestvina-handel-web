<!--
  The next step of the algorithm with its options (the C# suggestion menu) and, under the focused option, its further
  choices. "What will happen" shows what the selected move does, step by step, computed before it is applied (and
  used when it is), with a timeline to see each step in the views. After a step, the kinds ticked under "Automatic
  steps" follow by themselves (e.g. pulling tight). Below: back and forth in the history.
-->
<script lang="ts">
  import { combine, type MoveOption, type SuggestionKind, type Text, variants } from "../fibred/suggestions";
  import type { FibredSurface } from "../fibred/fibred-surface";
  import type { Preview } from "../session/session";
  import { describeMove } from "../session/describe";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  const KINDS: { kind: SuggestionKind; label: string }[] = [
    { kind: "collapse invariant subforest", label: "Collapse invariant forests" },
    { kind: "pull tight", label: "Pull tight" },
    { kind: "remove valence-1 junction", label: "Valence-1 junctions" },
    { kind: "remove valence-2 junctions", label: "Valence-2 junctions" },
    { kind: "absorb into periphery", label: "Absorb into the periphery" },
    { kind: "fold", label: "Folds" },
    { kind: "closed surface", label: "Closed surfaces (cut)" },
    { kind: "reducible", label: "Reduce (first piece)" },
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
  /** The option clicked last: its further choices are shown under it (also when several options are ticked). */
  let focused = $state(0);
  /** The choice selected under the focused option (undefined: the option itself, with its default choice). */
  let chosen = $state<number | undefined>(undefined);
  $effect(() => {
    void suggestion;
    selected = [0];
    focused = 0;
    chosen = undefined;
  });
  // The further choices of the focused option (e.g. how to fold), computed after the panel is drawn: some need the
  // move to be tried on a copy.
  let choices = $state.raw<{ list?: MoveOption[]; error?: string } | undefined>(undefined);
  $effect(() => {
    const option = suggestion?.options[focused];
    const surface = node?.surface;
    choices = undefined;
    if (!option || !surface) return;
    const timer = setTimeout(() => {
      try {
        choices = { list: variants(surface, option.move) };
      } catch (e) {
        choices = { error: e instanceof Error ? e.message : String(e) };
      }
    }, 0);
    return () => clearTimeout(timer);
  });

  function toggle(i: number) {
    focused = i;
    chosen = undefined;
    if (!suggestion?.multiple) selected = [i];
    else selected = selected.includes(i) ? selected.filter((j) => j !== i) : [...selected, i];
  }

  /** The move that Apply would apply: the selected choice, or the selected options. */
  const selectedMove = $derived.by(() => {
    if (!suggestion || suggestion.options.length === 0) return undefined;
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
  }
  const moments = $derived<Moment[]>(
    preview?.surface === undefined
      ? []
      : [
          ...preview.steps.map((s) => ({ text: s.text, surface: s.after })),
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
    // Show the state at the position in the views (not for moves that replace the surface's spine).
    const before = preview?.before;
    const shown = position === undefined || !before ? undefined : position === 0 ? before : moments[position - 1]?.surface;
    app.shown = shown && shown.spine0 === before?.spine0 ? shown : undefined;
    return () => (app.shown = undefined);
  });
  $effect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = (position ?? 0) + 1;
      position = Math.min(next, moments.length);
      if (next >= moments.length) playing = false;
    }, 900);
    return () => clearInterval(timer);
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

  /**
   * The last moves up to the current state, back to the last one that explains what it did (usually the move chosen,
   * followed by the automatic steps after it), at most five.
   */
  const recent = $derived.by(() => {
    const list: NonNullable<typeof node>[] = [];
    for (let n = node; n?.parent !== undefined && list.length < 5; n = n.parent) {
      list.unshift(n);
      if (n.steps?.length) break;
    }
    return list.some((n) => n.steps?.length) ? list : [];
  });

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
            title={option.discouraged ? "Possible now, but the algorithm does this only at the end" : undefined}
          >
            <label>
              <input
                type={suggestion.multiple ? "checkbox" : "radio"}
                name="option"
                checked={selected.includes(i) && (i !== focused || chosen === undefined)}
                onchange={() => toggle(i)}
              />
              <TextView text={option.label} />
            </label>
            {#if option.details}<div class="hint option-details"><TextView text={option.details} /></div>{/if}
            {#if i === focused}
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
                      {#if choice.rating !== undefined}<span class="rating" title="side crossings afterwards"
                          >{choice.rating}</span
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

  {#if suggestion?.options.length}
    <h3>What will happen</h3>
    {#if preview === undefined}
      <p class="note">Computing…</p>
    {:else if preview.error !== undefined}
      <p class="note">This can't be applied here: {preview.error}</p>
    {:else}
      <div class="timeline-controls">
        <button onclick={play} title="Show the steps one after the other in the views">{playing ? "⏸" : "▶"}</button>
        <span class="hint"
          >{position === undefined ? "Move the slider or press ▶ to see the steps." : `Step ${position} of ${moments.length}`}</span
        >
        {#if position !== undefined}
          <button
            class="link"
            onclick={() => {
              position = undefined;
              playing = false;
            }}>Show the current state</button
          >
        {/if}
      </div>
      <div class="will-happen">
        <input
          class="timeline"
          type="range"
          min="0"
          max={moments.length}
          step="1"
          value={position ?? 0}
          aria-label="Timeline of the steps"
          oninput={(event) => {
            playing = false;
            position = Number((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <ol>
          {#each moments as moment, k (k)}
            <li
              class:automatic-step={k >= preview.steps.length}
              class:pending={position !== undefined && k >= position}
              class:now={position === k + 1}
            >
              <TextView text={moment.text} surface={preview.before} />
            </li>
          {/each}
        </ol>
      </div>
      <p class="hint">
        {#if preview.automatic.length > 0}Steps {preview.steps.length + 1}–{moments.length} are the automatic steps after it.
        {/if}Afterwards: {preview.growth === undefined ? "the growth can't be computed" : `growth λ = ${preview.growth.toFixed(6)}`}
        <span class="timing">({preview.time.toFixed(0)} ms)</span>
      </p>
    {/if}
  {/if}

  <details class="automatic">
    <summary>Automatic steps ({app.automatic.length})</summary>
    <p class="hint">After each step you apply, steps of these kinds are done automatically; each is kept in the history.</p>
    <div class="checklist">
      {#each KINDS as { kind, label } (kind)}
        <label><input type="checkbox" checked={app.automatic.includes(kind)} onchange={() => toggleAutomatic(kind)} /> {label}</label>
      {/each}
    </div>
  </details>

  <h3>History</h3>
  {#if node}
    <div class="buttons">
      <button disabled={!node.parent} onclick={() => app.session && app.select(app.session.root)}>⤒ Start</button>
      <button disabled={!node.parent} onclick={() => node.parent && app.select(node.parent)}>
        ↑ Back{#if node.move}: <TextView text={describeMove(node.move)} surface={node.parent?.surface} />{/if}
      </button>
      <button onclick={() => (app.showHistory = !app.showHistory)}>{app.showHistory ? "Hide" : "Show"} the tree</button
      >
    </div>
    {#if recent.length > 0}
      <details class="what-happened">
        <summary>What happened</summary>
        {#each recent as step (step.id)}
          <div class="happened">
            <div class="happened-move">
              {#if step.move}<TextView text={describeMove(step.move)} surface={step.parent?.surface} />{/if}
            </div>
            {#if step.steps?.length}
              <ol>
                {#each step.steps as text, i (i)}<li><TextView text={text} surface={step.surface} /></li>{/each}
              </ol>
            {/if}
          </div>
        {/each}
      </details>
    {/if}
    {#if node.children.length > 0}
      <ul class="options">
        {#each node.children as child (child.id)}
          <li>
            <button class="link" onclick={() => app.select(child)}
              >↓ {#if child.move}<TextView text={describeMove(child.move)} surface={node.surface} />{/if}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>
