import { defineConfig, devices } from "@playwright/test";

// End-to-end tests in a real browser. Screenshot baselines depend on the platform's fonts: they are kept per
// platform, and CI runs with --ignore-snapshots (it only checks that the flows work).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:5199", viewport: { width: 1400, height: 900 } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
  ],
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
});
