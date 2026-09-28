<!-- The page: a header, the views of the surface on the left, the algorithm on the right, the history below. -->
<script lang="ts">
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { decodeSession, encodeSession } from "../session/share";
  import type { SessionFile } from "../session/session";
  import { download } from "./export";
  import HistoryView from "./HistoryView.svelte";
  import BoundaryPanel from "./BoundaryPanel.svelte";
  import EmbeddingPanel from "./EmbeddingPanel.svelte";
  import GatesPanel from "./GatesPanel.svelte";
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
    // A link entered in the address bar of an open page changes only the part after #, without reloading: open it.
    // (The autosave writes the address with history.replaceState, which doesn't fire this event.)
    const onHashChange = () => {
      void decodeSession(location.hash)
        .then((file) => {
          if (file) app.open(file);
        })
        .catch(() => (app.error = "This link doesn't contain a session that can be opened."));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
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
    <button onclick={() => (app.showHistory = !app.showHistory)}>{app.showHistory ? "Hide" : "Show"} the history tree</button>
    <button onclick={() => (app.sidebarLeft = !app.sidebarLeft)} title="Swap the panel of the algorithm and the panel of the analysis"
      >Swap panels</button
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
    <!-- The analysis on one side, the view in the middle, the algorithm (with its history) on the other side. -->
    <PaneGroup direction="horizontal" autoSaveId={app.sidebarLeft ? "layout-3-swapped" : "layout-3"}>
      <Pane defaultSize={24} minSize={12}>{#if app.sidebarLeft}{@render algorithm()}{:else}{@render analysis()}{/if}</Pane>
      <PaneResizer class="resizer" />
      <Pane defaultSize={52} minSize={25}>{@render views()}</Pane>
      <PaneResizer class="resizer" />
      <Pane defaultSize={24} minSize={12}>{#if app.sidebarLeft}{@render analysis()}{:else}{@render algorithm()}{/if}</Pane>
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

{#snippet algorithm()}
  <PaneGroup direction="vertical" autoSaveId="algorithm">
    <Pane defaultSize={app.showHistory ? 65 : 100} minSize={20}>
      <div class="sidebar"><SuggestionPanel /></div>
    </Pane>
    {#if app.showHistory}
      <PaneResizer class="resizer" />
      <Pane defaultSize={35} minSize={10}><HistoryView /></Pane>
    {/if}
  </PaneGroup>
{/snippet}

{#snippet analysis()}
  <div class="sidebar">
    <GatesPanel />
    <MapEditor />
    <InfoPanel />
    <MatrixPanel />
    <BoundaryPanel />
    <EmbeddingPanel />
  </div>
{/snippet}
