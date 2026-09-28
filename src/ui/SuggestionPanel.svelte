<!--
  The next step of the algorithm with its options (the C# suggestion menu) and further choices. After a step, the
  kinds ticked under "Automatic steps" follow by themselves (e.g. pulling tight). Below: back and forth in the history.
-->
<script lang="ts">
  import { combine, type MoveOption, type SuggestionKind, variants } from "../fibred/suggestions";
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
  let choices = $state<MoveOption[] | undefined>(undefined);
  $effect(() => {
    void suggestion;
    selected = [0];
    choices = undefined;
  });

  function toggle(i: number) {
    if (!suggestion?.multiple) selected = [i];
    else selected = selected.includes(i) ? selected.filter((j) => j !== i) : [...selected, i];
    choices = undefined;
  }
  function applySelected() {
    if (!suggestion) return;
    const moves = selected.map((i) => suggestion.options[i]?.move).filter((m) => m !== undefined);
    if (moves.length > 0) app.apply(combine(moves), { thenAutomatic: true });
  }
  function showChoices() {
    const option = suggestion?.options[selected[0] ?? 0];
    if (option && node) choices = variants(node.surface, option.move);
  }
  function toggleAutomatic(kind: SuggestionKind) {
    app.automatic = app.automatic.includes(kind) ? app.automatic.filter((k) => k !== kind) : [...app.automatic, kind];
  }
  function runToTheEnd() {
    app.runAutopilot(new Set(KINDS.map((k) => k.kind).filter((k) => k !== "reducible")));
  }
</script>

<section class="panel">
  <h2>Next step</h2>
  {#if suggestion}
    <p><TextView text={suggestion.description} /></p>
    {#if suggestion.options.length > 0}
      <ul class="options">
        {#each suggestion.options as option, i (i)}
          <li class:continues={typeof option.label[0] === "string" && option.label[0].startsWith("Next fold")}>
            <label>
              <input
                type={suggestion.multiple ? "checkbox" : "radio"}
                name="option"
                checked={selected.includes(i)}
                onchange={() => toggle(i)}
              />
              <TextView text={option.label} />
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  <div class="buttons">
    <button class="primary" onclick={applySelected} disabled={!suggestion?.options.length}>Apply</button>
    <button
      onclick={showChoices}
      disabled={!suggestion?.options.length}
      title="Further choices for the selected option, e.g. how to fold">More choices…</button
    >
    <button onclick={runToTheEnd} title="Apply the default of every step until the algorithm stops">Run to the end</button>
  </div>
  {#if choices}
    {#if choices.length === 0}
      <p class="note">No further choices for this option.</p>
    {:else}
      <ul class="options">
        {#each choices as choice, i (i)}
          <li>
            <button class="link" onclick={() => app.apply(choice.move, { thenAutomatic: true })}
              ><TextView text={choice.label} /></button
            >
            {#if choice.rating !== undefined}<span class="rating" title="side crossings afterwards">{choice.rating}</span>{/if}
          </li>
        {/each}
      </ul>
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
      <button onclick={() => (app.showHistory = !app.showHistory)}>{app.showHistory ? "Hide" : "Show"} the tree</button>
    </div>
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
