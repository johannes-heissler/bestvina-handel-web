<!--
  One view of the current state: the surface drawn in its model, with its own settings, pan and zoom. Hovering a strip
  highlights it in every view.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { HyperbolicModel } from "../geometry/hyperbolic";
  import type { SideStyle, Smoothing, ViewKind } from "../render/svg";
  import type { FibredSurface } from "../fibred/fibred-surface";
  import type { Text } from "../fibred/suggestions";
  import { matrixInfo, type MatrixInfo } from "../session/analysis";
  import { graphColors } from "./colors";
  import { draw, drawTimeline, type DrawOptions } from "./drawing";
  import { SIDE_FRACTION } from "../embedding/chart";
  import TextView from "./TextView.svelte";
  import { exportImage, type ExportFormat } from "./export";
  import { app } from "./state.svelte";

  let { initialView = "trainTrack" }: { initialView?: ViewKind } = $props();

  let view = $state<ViewKind>(untrack(() => initialView)); // the prop only sets the initial view
  let model = $state<HyperbolicModel>("poincare");
  let smoothing = $state<Smoothing>("spline");
  let sideStyle = $state<SideStyle>("dashed");
  let dashUntil = $state(0.3);
  let scaleNames = $state(true);
  let kleinNames = $state(false);
  let deckDepth = $state(0);
  let widthExponent = $state(0);
  let straightening = $state(10);
  /** The part of each side the crossings may use (undefined: the default of the kind of polygon). */
  let sideFraction = $state<number | undefined>(undefined);
  let pointerSize = $state(4); // the radius of the dot under the mouse, in pixels at the centre (0: no dot)
  let labels = $state(true);
  let showOptions = $state(true);

  const node = $derived.by(() => {
    void app.version;
    return app.session?.current;
  });
  const hyperbolic = $derived(node?.model.kind === "polygon" && node.model.geometry.kind !== "flat");
  const defaultSideFraction = $derived(
    node?.model.kind === "polygon" ? SIDE_FRACTION[node.model.geometry.kind] : undefined,
  );
  const rendered = $derived.by(() => {
    if (node === undefined) return undefined;
    const shown = app.shown;
    const options: DrawOptions = {
      view,
      model,
      smoothing,
      sideStyle,
      dashUntil,
      scaleNames,
      kleinNames,
      deckDepth,
      widthExponent,
      straightening,
      ...(sideFraction !== undefined && { sideFraction }),
      labels,
      // The highlight belongs to the current state, not to a step of the timeline.
      ...(shown === undefined && app.highlight.length > 0 && { highlight: app.highlight }),
      size: 800,
    };
    if (shown !== undefined && "states" in shown)
      return drawTimeline(node.model, shown.states, shown.motions, shown.position, options);
    return draw(node.model, shown?.surface ?? node.surface, options);
  });

  // Pan and zoom.
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging: { x: number; y: number } | undefined;
  let mouse = $state({ x: 0, y: 0 });
  // The point under the mouse, as a dot in the polygon and in each copy (sized by the hyperbolic metric).
  let surfaceElement: HTMLDivElement | undefined = $state();
  let dots = $state<{ x: number; y: number; r: number }[]>([]);
  function updateDots(event: PointerEvent) {
    const svg = surfaceElement?.querySelector("svg:not(.echo)") as SVGSVGElement | null;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || !rendered) {
      dots = [];
      return;
    }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    dots = rendered.echo(p.x, p.y);
  }

  // The card for the strip under the mouse: its images under g and μ, its width and length.
  const weights = new WeakMap<FibredSurface, MatrixInfo>();
  const card = $derived.by(() => {
    const shown = app.shown;
    const surface =
      shown === undefined
        ? node?.surface
        : "states" in shown
          ? shown.states[Math.min(Math.round(shown.position), shown.states.length - 1)]
          : shown.surface;
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
    updateDots(event);
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
      : `<style>.surface [data-edge="${CSS.escape(app.hovered)}"] { stroke-width: var(--grow, 2px); stroke-opacity: 1; }</style>`,
  );
</script>

<section class="panel view">
  <div class="toolbar">
    <label
      >View
      <select bind:value={view}>
        <option value="trainTrack">Train track τ</option>
        <option value="standard">Standard</option>
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
    <span class="spacer"></span>
    <button onclick={() => (showOptions = !showOptions)} aria-expanded={showOptions} title="Show or hide the graphics options"
      >{showOptions ? "▾" : "▸"} Graphics options</button
    >
    <button onclick={reset} title="Reset pan and zoom">⟲</button>
    <select bind:value={exportFormat} aria-label="Export format">
      <option value="svg">SVG</option>
      <option value="pdf">PDF</option>
      <option value="png">PNG</option>
      <option value="jpeg">JPEG</option>
    </select>
    <button onclick={exportView}>Export</button>
  </div>
  {#if showOptions}
    <div class="toolbar options">
      <label
        title="How the corners of the strips are drawn, e.g. where they enter a band or cross a side that isn't straightened"
        >Corners
        <select bind:value={smoothing}>
          <option value="spline">Smooth</option>
          <option value="rounded">Rounded</option>
          <option value="none">Sharp</option>
        </select></label
      >
      <label
        >Sides
        <select bind:value={sideStyle}>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="solid">Solid</option>
        </select></label
      >
      {#if hyperbolic && sideStyle !== "solid"}
        <label title="Down to which width (pixels) the sides are dashed; thinner, towards the boundary, they fade"
          >dashed down to <input type="range" min="0.1" max="1.5" step="0.05" bind:value={dashUntil} /> {dashUntil.toFixed(2)} px</label
        >
      {/if}
      <label title="Copies of the polygon by deck transformations">Copies <input type="number" min="0" max="4" bind:value={deckDepth} /></label>
      <label
        title="The weights w(e)^c of the strips, with the Perron–Frobenius widths w(e) (as in 'Transition matrix, widths, lengths'). Every strip is drawn with a width proportional to w(e)^c: c = 0 all equally wide, c = 1 exactly in the ratios of the widths w, in between in the same order but closer together. (All widths are then shrunk by one common factor until the strands fit.) The weights also space the strands on the sides before straightening."
        >Width exponent c <input type="range" min="0" max="1" step="0.1" bind:value={widthExponent} />
        {widthExponent.toFixed(1)}</label
      >
      <label
        title="Rounds of moving the crossings with the glued sides so that the strips run straight (geodesically) through them, keeping their order and staying on the side (0: evenly spaced crossings)"
        >Straightening <input type="range" min="0" max="30" step="1" bind:value={straightening} /> {straightening}</label
      >
      {#if defaultSideFraction !== undefined}
        <label
          title="How close to the ends of the sides the strips may cross them: the part of each side (around its middle) that the crossings may use. For ideal polygons, whose sides are infinitely long, it is measured along the side in the Klein model."
          >Crossings reach <input
            type="range"
            min="0.1"
            max="0.98"
            step="0.02"
            value={sideFraction ?? defaultSideFraction}
            oninput={(event) => (sideFraction = Number((event.currentTarget as HTMLInputElement).value))}
          />
          {Math.round((sideFraction ?? defaultSideFraction) * 100)}% of a side</label
        >
      {/if}
      <label title="The dot under the mouse, shown in the polygon and in every copy; its radius in pixels at the centre of the model, shrinking with the metric (0: no dot)"
        >Pointer size <input type="range" min="0" max="12" step="0.5" bind:value={pointerSize} /> {pointerSize}</label
      >
      <label><input type="checkbox" bind:checked={labels} /> Show names</label>
      {#if hyperbolic && labels}
        <label title="Scale the names with the hyperbolic metric (the copies then get names too)"
          ><input type="checkbox" bind:checked={scaleNames} /> Names scaled by the metric</label
        >
        {#if model === "klein" && scaleNames}
          <label title="Shape the names and junctions like the Klein metric: squeezed towards the boundary"
            ><input type="checkbox" bind:checked={kleinNames} /> Names and junctions shaped by the Klein metric</label
          >
        {/if}
      {/if}
    </div>
  {/if}
  <div
    class="canvas"
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={() => {
      app.hovered = undefined;
      dots = [];
    }}
    role="img"
    aria-label="The fibred surface"
  >
    <div class="surface" bind:this={surfaceElement} style:transform={`translate(${panX}px, ${panY}px) scale(${zoom})`}>
      <!-- The SVG comes from our own renderer (src/render/svg.ts), not from user input. -->
      {@html highlight}{@html rendered?.svg ?? ""}
      {#if dots.length && pointerSize > 0}
        <svg class="echo" viewBox="0 0 800 800" aria-hidden="true">
          {#each dots as d, i (i)}<circle cx={d.x} cy={d.y} r={(d.r * pointerSize) / 4} />{/each}
        </svg>
      {/if}
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
