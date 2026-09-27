import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Only this file runs in Node; the app itself has no Node types.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // For GitHub Pages the app lives under /<repository>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [svelte()],
  // Component tests need Svelte's browser build.
  ...(process.env.VITEST ? { resolve: { conditions: ["browser"] } } : {}),
  test: {
    include: ["src/**/*.test.ts"],
  },
});
