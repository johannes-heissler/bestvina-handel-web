<!-- The page: a header, the views of the surface on the left, the algorithm on the right, the history below. -->
<script lang="ts">
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { decodeSession, encodeSession } from "../session/share";
  import type { SessionFile } from "../session/session";
  import { download } from "./export";
  import HistoryView from "./HistoryView.svelte";
  import BoundaryPanel from "./BoundaryPanel.svelte";
  import EmbeddingPanel from "./EmbeddingPanel.svelte";
  import InfoPanel from "./InfoPanel.svelte";
  import MatrixPanel from "./MatrixPanel.svelte";
  import MapEditor from "./MapEditor.svelte";
  import StartDialog from "./StartDialog.svelte";
  import { app } from "./state.svelte";
  import SuggestionPanel from "./SuggestionPanel.svelte";
  import SurfaceView from "./SurfaceView.svelte";

  let secondView = $state(false);

  $effect(() => {
    void decodeSession(location.hash)
      .then((file) => {
        if (file) app.open(file);
        else app.showStart = true;
      })
      .catch(() => (app.showStart = true));
  });

  function save() {
    const file = app.session?.toFile();
    if (file) download(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }), "session.json");
  }
  async function open(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) app.open(JSON.parse(await file.text()) as SessionFile);
  }
  async function copyLink() {
    const file = app.session?.toFile();
    if (!file) return;
    const url = `${location.origin}${location.pathname}#${await encodeSession(file)}`;
    await navigator.clipboard.writeText(url);
    app.message = "The link to this session is in the clipboard.";
  }
</script>

<header>
  <h1>Bestvina–Handel</h1>
  <nav>
    <button onclick={() => (app.showStart = true)}>New…</button>
    <button onclick={save} disabled={!app.session}>Save</button>
    <label class="button">Open <input type="file" accept="application/json,.json" onchange={open} hidden /></label>
    <button onclick={copyLink} disabled={!app.session}>Copy link</button>
    <button onclick={() => (secondView = !secondView)}>{secondView ? "One view" : "Two views"}</button>
    <button onclick={() => (app.showHistory = !app.showHistory)}>History</button>
    <button onclick={() => (app.sidebarLeft = !app.sidebarLeft)} title="Move the panel with the algorithm to the other side"
      >Panel {app.sidebarLeft ? "right" : "left"}</button
    >
  </nav>
</header>
{#if app.error}
  <p class="error banner" role="alert">
    {app.error} <button class="link" onclick={() => (app.error = undefined)} aria-label="Dismiss">×</button>
  </p>
{/if}
{#if app.message}
  <p class="message banner">
    {app.message} <button class="link" onclick={() => (app.message = undefined)} aria-label="Dismiss">×</button>
  </p>
{/if}

<main>
  {#if app.session}
    <PaneGroup direction="vertical">
      <Pane defaultSize={75}>
        <PaneGroup direction="horizontal" autoSaveId={app.sidebarLeft ? "layout-left" : "layout-right"}>
          {#if app.sidebarLeft}
            <Pane defaultSize={36} minSize={20}>{@render sidebar()}</Pane>
            <PaneResizer class="resizer" />
            <Pane defaultSize={64} minSize={30}>{@render views()}</Pane>
          {:else}
            <Pane defaultSize={64} minSize={30}>{@render views()}</Pane>
            <PaneResizer class="resizer" />
            <Pane defaultSize={36} minSize={20}>{@render sidebar()}</Pane>
          {/if}
        </PaneGroup>
      </Pane>
      {#if app.showHistory}
        <PaneResizer class="resizer" />
        <Pane defaultSize={25} minSize={10}><HistoryView /></Pane>
      {/if}
    </PaneGroup>
  {:else}
    <p class="empty">
      Choose an example or a surface to begin. <button onclick={() => (app.showStart = true)}>Start</button>
    </p>
  {/if}
</main>
<StartDialog />

{#snippet views()}
  {#if secondView}
    <PaneGroup direction="horizontal">
      <Pane defaultSize={50}><SurfaceView /></Pane>
      <PaneResizer class="resizer" />
      <Pane defaultSize={50}><SurfaceView initialView="striped" /></Pane>
    </PaneGroup>
  {:else}
    <SurfaceView />
  {/if}
{/snippet}

{#snippet sidebar()}
  <div class="sidebar" class:left={app.sidebarLeft}>
    <SuggestionPanel />
    <MapEditor />
    <InfoPanel />
    <MatrixPanel />
    <BoundaryPanel />
    <EmbeddingPanel />
  </div>
{/snippet}
