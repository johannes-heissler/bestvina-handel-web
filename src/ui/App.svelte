<!-- The page: a header, the views of the surface on the left, the algorithm on the right, the history below. -->
<script lang="ts">
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { decodeSession, encodeSession } from "../session/share";
  import { download } from "./export";
  import { saveSession, savedSessions } from "./storage";
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

  function saveToFile() {
    const file = app.session?.toFile();
    if (file) download(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }), "session.json");
  }
  /** Saves the session in this browser under a name (asked for; the same name replaces the older session). */
  async function saveInBrowser() {
    const session = app.session;
    if (!session) return;
    const start = session.start;
    const origin =
      start.kind === "preset"
        ? `${start.preset}${start.seed !== undefined ? ` (seed ${start.seed})` : ""}`
        : start.model.name;
    const name = prompt("Save this session in the browser as", `${origin}, ${new Date().toLocaleString()}`)?.trim();
    if (!name) return;
    const existing = await savedSessions();
    if (existing.some((s) => s.name === name) && !confirm(`Replace the saved session “${name}”?`)) return;
    const ok = await saveSession(name, session.toFile());
    if (ok) app.message = `Saved in this browser as “${name}”. Open it again with “Open…”.`;
    else app.error = "The browser didn't allow saving (e.g. in a private window). Use “Save to file” instead.";
  }
  function openDialog() {
    app.startTab = "open";
    app.showStart = true;
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
    <button
      onclick={() => {
        app.startTab = "examples";
        app.showStart = true;
      }}>New…</button
    >
    <button onclick={saveInBrowser} disabled={!app.session} title="Save the session in this browser, under a name"
      >Save in browser</button
    >
    <button onclick={saveToFile} disabled={!app.session} title="Download the session as a file">Save to file</button>
    <button onclick={openDialog} title="Open a session saved in this browser or in a file">Open…</button>
    <button onclick={copyLink} disabled={!app.session}>Copy link</button>
    <button onclick={() => (secondView = !secondView)}>{secondView ? "One view" : "Two views"}</button>
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
    <Pane defaultSize={65} minSize={20}>
      <div class="sidebar"><SuggestionPanel /></div>
    </Pane>
    <PaneResizer class="resizer" />
    <!-- (Always there; drag it small to see more of the step.) -->
    <Pane defaultSize={35} minSize={4}><HistoryView /></Pane>
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
