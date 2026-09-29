import { afterAll, beforeAll, expect, inject } from "vitest";
import type { Browser, Page } from "playwright";
import { launch, openPage, type Viewport } from "../browser";

// Shared by every spec/layout/*.test.ts. The suites are split across files
// by area only so vitest can run them in parallel (it runs a file's tests
// one after another); each file gets its own Chromium, all against the one
// server global-setup.ts boots.

export const baseUrl = inject("baseUrl");

// A live binding: set by useBrowser's beforeAll, read by the tests.
export let browser: Browser;

// Call once at the top of each test file.
export function useBrowser(): void {
  beforeAll(async () => {
    browser = await launch();
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
  });
}

export const planUrl = () => new URL("/plan/example", baseUrl).href;

// Side-by-side widths that a key, toggle, fold or details opening changes
// ease over 200ms, so geometry is read once the transitions have finished.
export const settle = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0);

// The one details sidebar every Details entry point opens.
export const detailsPanel = (page: Page) => page.locator('aside[aria-label="Course details"]');

// What every Details entry point must do once activated: show the one panel
// on `code`, put it in the URL, and undo both on Close.
export async function expectDetailsOpenThenClose(page: Page, code: string): Promise<void> {
  const panel = detailsPanel(page);
  await panel.waitFor();
  expect(await panel.count()).toBe(1);
  expect(await panel.locator("h2").textContent()).toContain(code);
  await expect.poll(() => new URL(page.url()).searchParams.get("course")).toBe(code);
  await panel.getByRole("button", { name: "Close details" }).click();
  await expect.poll(() => panel.count()).toBe(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("course")).toBe(false);
}

// Search lives in a palette opened from the plan header, so every search
// test opens it first.
export async function openSearch(page: Page): Promise<void> {
  await page.locator(".search-trigger").click();
  await page.locator(".palette input").waitFor();
}

export async function withPlan<T>(viewport: Viewport, check: (page: Page) => Promise<T>): Promise<T> {
  const page = await openPage(browser, planUrl(), viewport);
  try {
    return await check(page);
  } finally {
    await page.close();
  }
}

// Creates an editable plan with `code` placed in `term` (default 0) and
// returns its id.
export async function planWithPlacement(code: string, term = 0): Promise<string> {
  const created = await fetch(new URL("/api/plans", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    redirect: "manual",
  });
  const id = created.headers.get("location")!.split("/").pop()!;
  const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ code, term }),
  });
  expect(placed.status).toBe(200);
  return id;
}

// The colour the page renders at (x, y), read back from a screenshot, for
// the cases only paint shows: what a translucent layer lets through.
export async function pixelAt(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, png.toString("base64"));
}

// Near the top of the details header's inline-end padding, which lies
// over whatever is behind the panel: the panel's own white must reach it,
// or the frosted header shows the page through its end.
export async function detailsHeadEnd(page: Page): Promise<[number, number, number]> {
  const box = await detailsPanel(page)
    .locator(".details-head")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.right - 8, y: r.top + 40 };
    });
  return pixelAt(page, Math.round(box.x), Math.round(box.y));
}
