import { expect, type Page, test } from "@playwright/test";

async function startExample(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".surface svg")).toBeVisible();
}

test("starts an example and draws it", async ({ page }) => {
  await startExample(page, "Anosov map of the torus");
  await expect.poll(() => page.locator(".surface svg path[data-edge]").count()).toBeGreaterThan(0);
  await expect(page.getByText("pseudo-Anosov, λ = 2.618034")).toBeVisible();
  await expect(page).toHaveScreenshot("torus.png");
});

test("runs the algorithm to the end", async ({ page }) => {
  await startExample(page, "Bestvina–Handel example 6.1");
  await page.getByRole("button", { name: "Run to the end" }).click();
  await expect(page.getByText(/pseudo-Anosov, λ = /)).toBeVisible();
  await expect(page).toHaveScreenshot("bh61-end.png");
});

test("starts a surface from the gallery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "New surface" }).click();
  await page.getByRole("button", { name: /L-shaped surface/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".surface svg")).toBeVisible();
  await expect(page).toHaveScreenshot("l-shape.png");
});

test("applies a step and goes back in the history", async ({ page }) => {
  await startExample(page, "Point push");
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByRole("button", { name: /↑ Back:/ })).toBeEnabled();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect.poll(() => page.locator(".history circle").count()).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: /↑ Back:/ }).click();
  await expect(page.getByRole("button", { name: /↓/ })).toBeVisible();
});

test("restores a session from its link", async ({ page }) => {
  await startExample(page, "Half twist");
  await page.getByRole("button", { name: "Run to the end" }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#s=/);
  const url = page.url();
  const state = await page.locator(".panel dl").innerText();
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator(".panel dl")).toHaveText(state);
});
