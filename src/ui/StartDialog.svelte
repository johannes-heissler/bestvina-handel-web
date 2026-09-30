<!-- Choosing what to study: an example, a surface from the gallery, a ribbon graph, or a saved session. -->
<script lang="ts">
  import { Dialog } from "bits-ui";
  import { gallery } from "../examples/gallery";
  import type { SurfaceModel } from "../examples/models";
  import { PRESETS } from "../examples/presets";
  import type { SessionFile } from "../session/session";
  import { app, AUTOSAVE_KEY } from "./state.svelte";
  import { deleteSession, load, type SavedSession, savedSessions } from "./storage";
  import Thumbnail from "./Thumbnail.svelte";

  const tab = $derived(app.startTab);
  let genus = $state(2);
  let punctures = $state(1);
  let peripheral = $state(0);
  let chosen = $state(0);
  let map = $state("");
  let words = $state("a b A B c d C D");
  let closed = $state(false);
  let peripheralStrips = $state("");
  let seed = $state(1);
  let last = $state<SessionFile | undefined>(undefined);
  let saved = $state.raw<SavedSession<SessionFile>[]>([]);

  // Read the stored sessions whenever the dialog opens.
  $effect(() => {
    if (!app.showStart) return;
    void load<SessionFile>(AUTOSAVE_KEY).then((file) => (last = file));
    void savedSessions<SessionFile>().then((list) => (saved = list));
  });
  async function remove(name: string) {
    if (!confirm(`Delete the saved session “${name}”?`)) return;
    await deleteSession(name);
    saved = await savedSessions<SessionFile>();
  }
  /** The number of moves in a saved session (the nodes of its history tree). */
  function moves(file: SessionFile): number {
    const count = (node: { children?: readonly unknown[] }): number =>
      (node.children ?? []).reduce<number>((n, child) => n + 1 + count(child as { children?: readonly unknown[] }), 0);
    return count(file.tree as { children?: readonly unknown[] });
  }

  const models = $derived.by((): SurfaceModel[] => {
    try {
      return gallery(genus, punctures);
    } catch {
      return [];
    }
  });
  $effect(() => {
    if (peripheral >= Math.max(punctures, 1)) peripheral = Math.max(0, punctures - 1);
    if (chosen >= models.length) chosen = 0;
  });

  function startSurface() {
    const model = models[chosen];
    if (model) app.start({ kind: "model", model, options: { peripheral }, map });
  }
  function startRibbon() {
    const boundaryWords = words
      .split(/\n|;/)
      .map((w) => w.trim().split(/\s+/).filter(Boolean))
      .filter((w) => w.length > 0);
    const model: SurfaceModel = { kind: "ribbon", name: "Ribbon graph", description: "Given by its boundary words.", boundaryWords, closed };
    const strips = peripheralStrips.split(/[\s,]+/).filter(Boolean);
    app.start({ kind: "model", model, options: { peripheralStrips: strips }, map });
  }
  async function openFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) app.open(JSON.parse(await file.text()) as SessionFile);
  }
</script>

<Dialog.Root bind:open={app.showStart}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog">
      <Dialog.Title>Start</Dialog.Title>
      <Dialog.Description class="hint">Choose a surface and a mapping class.</Dialog.Description>
      <div class="tabs" role="tablist">
        {#each [["examples", "Examples"], ["surface", "New surface"], ["ribbon", "Ribbon graph"], ["open", "Open"]] as [id, label] (id)}
          <button role="tab" aria-selected={tab === id} class:active={tab === id} onclick={() => (app.startTab = id as typeof tab)}>{label}</button>
        {/each}
      </div>

      {#if tab === "examples"}
        {#if last}
          <button class="primary wide" onclick={() => last && app.open(last)}>Continue the last session</button>
        {/if}
        <ul class="examples">
          {#each PRESETS as preset (preset.name)}
            <li>
              <button
                class="link"
                onclick={() =>
                  app.start(
                    preset.name.startsWith("Random")
                      ? { kind: "preset", preset: preset.name, seed }
                      : { kind: "preset", preset: preset.name },
                  )}><strong>{preset.name}</strong></button
              >
              <span class="hint">{preset.description}</span>
              {#if preset.name.startsWith("Random")}<label class="hint">seed <input type="number" bind:value={seed} /></label>{/if}
            </li>
          {/each}
        </ul>
      {:else if tab === "surface"}
        <div class="buttons">
          <label>Genus <select bind:value={genus}>{#each [0, 1, 2, 3, 4] as g (g)}<option value={g}>{g}</option>{/each}</select></label>
          <label
            >Punctures <select bind:value={punctures}
              >{#each [0, 1, 2, 3, 4, 5, 6] as p (p)}<option value={p}>{p === 0 ? "0 (closed)" : p}</option>{/each}</select
            ></label
          >
          <label
            >Peripheral <select bind:value={peripheral}
              >{#each Array.from({ length: Math.max(punctures, 1) }, (_, i) => i) as k (k)}<option value={k}>{k}</option>{/each}</select
            ></label
          >
        </div>
        {#if models.length === 0}
          <p class="note">The algorithm needs a surface with negative Euler characteristic.</p>
        {:else}
          <div class="gallery">
            {#each models as model, i (`${genus}-${punctures}-${i}`)}
              <button class="card" class:active={chosen === i} onclick={() => (chosen = i)} title={model.description}>
                <Thumbnail {model} cacheKey={`${genus}-${punctures}-${i}-${model.name}`} />
                <span>{model.name}</span>
              </button>
            {/each}
          </div>
          <label class="wide">Map (optional, can be set later)<textarea rows="3" bind:value={map} placeholder="a -> a b, b -> b a b"></textarea></label>
          <button class="primary" onclick={startSurface}>Start</button>
        {/if}
      {:else if tab === "ribbon"}
        <label class="wide"
          >Boundary words (one per line; "a" and its inverse "A")<textarea rows="3" bind:value={words}></textarea></label
        >
        <div class="buttons">
          <label><input type="checkbox" bind:checked={closed} /> closed surface (the single puncture is artificial)</label>
          <label>Peripheral strips <input bind:value={peripheralStrips} placeholder="p, q" size="8" /></label>
        </div>
        <label class="wide">Map<textarea rows="3" bind:value={map} placeholder="a -> a b, b -> b a b"></textarea></label>
        <button class="primary" onclick={startRibbon}>Start</button>
      {:else}
        <h3>Saved in this browser</h3>
        {#if last}
          <button class="link" onclick={() => last && app.open(last)}>Continue the last session (saved automatically after every step)</button>
        {/if}
        {#if saved.length === 0}
          <p class="hint">No sessions saved with “Save in browser” yet.</p>
        {:else}
          <table class="saved">
            <tbody>
              {#each saved as entry (entry.name)}
                <tr>
                  <td><button class="link" onclick={() => app.open(entry.file)}>{entry.name}</button></td>
                  <td class="hint">{new Date(entry.savedAt).toLocaleString()}, {moves(entry.file)} moves</td>
                  <td><button onclick={() => remove(entry.name)} title="Delete this saved session">Delete</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
        <p class="hint">
          Sessions saved in the browser stay in this browser on this computer (not in a private window). To keep them
          elsewhere, use “Save to file” or “Copy link”.
        </p>
        <h3>From a file</h3>
        <p>Open a session saved with “Save to file”.</p>
        <input type="file" accept="application/json,.json" onchange={openFile} />
      {/if}
      {#if app.error}<p class="error">{app.error}</p>{/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
