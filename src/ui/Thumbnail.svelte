<!-- A gallery picture: rendered the first time, then taken from the browser's cache. -->
<script lang="ts">
  import { initialFibredSurface, type SurfaceModel } from "../examples/models";
  import { draw } from "./drawing";
  import { load, store } from "./storage";

  let { model, cacheKey }: { model: SurfaceModel; cacheKey: string } = $props();
  let svg = $state("");

  $effect(() => {
    const key = `thumbnail:v1:${cacheKey}`;
    let cancelled = false;
    void load<string>(key).then((cached) => {
      if (cancelled) return;
      if (cached) svg = cached;
      else {
        svg = draw(model, initialFibredSurface(model), { size: 220, labels: false }).svg;
        void store(key, svg);
      }
    });
    return () => (cancelled = true);
  });
</script>

<!-- The SVG comes from our own renderer (src/render/svg.ts), not from user input. -->
<div class="thumbnail">{@html svg}</div>
