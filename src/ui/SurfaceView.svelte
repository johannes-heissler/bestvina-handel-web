<!--
  One view of the current state: the surface drawn in its model, with its own settings, pan and zoom. Hovering a strip
  highlights it in every view.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { HyperbolicModel } from "../geometry/hyperbolic";
  import type { Smoothing, ViewKind } from "../render/svg";
  import type { FibredSurface } from "../fibred/fibred-surface";
  import type { Text } from "../fibred/suggestions";
  import { matrixInfo, type MatrixInfo } from "../session/analysis";
  import { graphColors } from "./colors";
  import { draw } from "./drawing";
  import TextView from "./TextView.svelte";
  import { exportImage, type ExportFormat } from "./export";
  import { app } from "./state.svelte";

  let { initialView = "trainTrack" }: { initialView?: ViewKind } = $props();

  let view = $state<ViewKind>(untrack(() => initialView)); // the prop only sets the initial view
  let model = $state<HyperbolicModel>("poincare");
  let smoothing = $state<Smoothing>("spline");
  let deckDepth = $state(0);
  let widthExponent = $state(0);
  let toScale = $state(false);
  let labels = $state(true);

  const node = $derived.by(() => {
    void app.version;
    return app.session?.current;
  });
  const hyperbolic = $derived(node?.model.kind === "polygon" && node.model.geometry.kind !== "flat");
  const rendered = $derived.by(() => {
    if (node === undefined) return undefined;
    return draw(node.model, node.surface, {
      view,
      model,
      smoothing,
      deckDepth,
      widthExponent,
      labels,
      stripWidth: toScale ? "toScale" : "uniform",
      size: 800,
    });
  });

  // Pan and zoom.
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging: { x: number; y: number } | undefined;
  let mouse = $state({ x: 0, y: 0 });

  // The card for the strip under the mouse: its images under g and μ, its width and length.
  const weights = new WeakMap<FibredSurface, MatrixInfo>();
  const card = $derived.by(() => {
    const surface = node?.surface;
    const name = app.hovered;
    if (!surface || name === undefined || dragging) return undefined;
    const e = surface.graph.edges.find((x) => x.name === name);
    if (!e) return undefined;
    let info = weights.get(surface);
    if (!info) weights.set(surface, (info = matrixInfo(surface)));
    const path = (letters: readonly { name: string }[]): Text =>
      letters.length === 0 ? ["·"] : letters.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }]));
    return {
      name,
      g: path(surface.g.image(e.forward).letters),
      mu: path(surface.mu.image(e.forward).letters),
      palette: graphColors(surface.spine0),
      width: info.widths.get(e),
      length: info.lengths.get(e),
    };
  });

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const [mx, my] = [event.clientX - rect.left, event.clientY - rect.top];
    panX = mx - (mx - panX) * factor;
    panY = my - (my - panY) * factor;
    zoom *= factor;
  }
  function onPointerDown(event: PointerEvent) {
    dragging = { x: event.clientX - panX, y: event.clientY - panY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (dragging) {
      panX = event.clientX - dragging.x;
      panY = event.clientY - dragging.y;
      return;
    }
    const target = (event.target as Element).closest?.("[data-edge]");
    app.hovered = target?.getAttribute("data-edge") ?? undefined;
  }
  function onPointerUp() {
    dragging = undefined;
  }
  function reset() {
    [zoom, panX, panY] = [1, 0, 0];
  }

  let exportFormat = $state<ExportFormat>("svg");
  async function exportView() {
    if (rendered?.svg) await exportImage(rendered.svg, "bestvina-handel", exportFormat);
  }

  const highlight = $derived(
    app.hovered === undefined
      ? ""
      : `<style>.surface [data-edge="${CSS.escape(app.hovered)}"] { stroke-width: 5px; stroke-opacity: 1; }</style>`,
  );
</script>

<section class="panel view">
  <div class="toolbar">
    <label
      >View
      <select bind:value={view}>
        <option value="trainTrack">Train track τ</option>
        <option value="striped">Striped f(F) ⊆ F</option>
      </select></label
    >
    {#if hyperbolic}
      <label
        >Model
        <select bind:value={model}>
          <option value="poincare">Poincaré disk</option>
          <option value="klein">Klein disk</option>
          <option value="halfplane">Upper half-plane</option>
        </select></label
      >
    {/if}
    <label
      >Curves
      <select bind:value={smoothing}>
        <option value="spline">Smooth</option>
        <option value="rounded">Rounded corners</option>
        <option value="none">Straight</option>
      </select></label
    >
    <label title="Copies of the polygon by deck transformations">Copies <input type="number" min="0" max="4" bind:value={deckDepth} /></label>
    <label title="Strand widths w(e)^c: 0 spaces them evenly"
      >Widths c <input type="range" min="0" max="1" step="0.1" bind:value={widthExponent} /></label
    >
    <label><input type="checkbox" bind:checked={toScale} /> To scale</label>
    <label><input type="checkbox" bind:checked={labels} /> Names</label>
    <span class="spacer"></span>
    <button onclick={reset} title="Reset pan and zoom">⟲</button>
    <select bind:value={exportFormat} aria-label="Export format">
      <option value="svg">SVG</option>
      <option value="pdf">PDF</option>
      <option value="png">PNG</option>
      <option value="jpeg">JPEG</option>
    </select>
    <button onclick={exportView}>Export</button>
  </div>
  <div
    class="canvas"
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={() => (app.hovered = undefined)}
    role="img"
    aria-label="The fibred surface"
  >
    <div class="surface" style:transform={`translate(${panX}px, ${panY}px) scale(${zoom})`}>
      <!-- The SVG comes from our own renderer (src/render/svg.ts), not from user input. -->
      {@html highlight}{@html rendered?.svg ?? ""}
    </div>
    {#if card}
      <div class="hover-card" style:left={`${mouse.x + 16}px`} style:top={`${mouse.y + 16}px`}>
        <div><TextView text={[{ strip: card.name }]} /> ↦ <TextView text={card.g} /></div>
        <div class="hint">μ: <TextView text={card.mu} palette={card.palette} /></div>
        <div class="hint">
          width {card.width === undefined ? "—" : card.width.toFixed(3)}, length {card.length === undefined
            ? "—"
            : card.length.toFixed(3)}
        </div>
      </div>
    {/if}
  </div>
  {#each rendered?.notes ?? [] as note (note)}<p class="note">{note}</p>{/each}
</section>
