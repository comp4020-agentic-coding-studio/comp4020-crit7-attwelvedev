import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, openPage, type Viewport } from "../browser";
import { baseUrl, browser, detailsPanel, openSearch, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };
const phone = { width: 390, height: 844 };

const palette = (page: Page) => page.locator(".palette");

async function onPlan(id: string, viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
  const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
  try {
    await check(page);
  } finally {
    await page.close();
  }
}

async function search(page: Page, query: string): Promise<void> {
  await page.fill(".course-search input", query);
  await page.click(".course-search button[type=submit]");
}

describe("search palette", { timeout: 30_000 }, () => {
  it.each([desktop, phone])("header trigger opens the palette and focuses its input at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      const trigger = page.getByRole("button", { name: "Search courses" });
      expect(await trigger.count()).toBe(1);
      if (viewport === phone) {
        const box = (await trigger.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Search courses" });
      await dialog.waitFor();
      expect(await dialog.getAttribute("aria-modal")).toBe("true");
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.matches(".palette input") ?? false))
        .toBe(true);
    });
  });

  it("⌘K and Ctrl-K toggle the palette; Escape closes it and returns focus to the trigger", async () => {
    await withPlan(desktop, async (page) => {
      for (const mod of ["Meta", "Control"]) {
        await page.keyboard.press(`${mod}+k`);
        await expect.poll(() => palette(page).count(), { message: mod }).toBe(1);
        await page.keyboard.press(`${mod}+k`);
        await expect.poll(() => palette(page).count(), { message: mod }).toBe(0);
      }
      await openSearch(page);
      await page.keyboard.press("Escape");
      await expect.poll(() => palette(page).count()).toBe(0);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.classList.contains("search-trigger") ?? false))
        .toBe(true);
    });
  });

  it("keeps Tab inside the palette, and a click on the backdrop closes it", async () => {
    await withPlan(desktop, async (page) => {
      await openSearch(page);
      for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        expect(await page.evaluate(() => !!document.activeElement?.closest(".palette")), key).toBe(true);
      }
      await page.mouse.click(5, desktop.height - 5);
      await expect.poll(() => palette(page).count()).toBe(0);
    });
  });

  it("Requirements has no Search section", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator("aside#requirements .course-search").count()).toBe(0);
    });
  });

  it("results match the old section: a card with Place in…, or a placed row", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, desktop, async (page) => {
      await openSearch(page);
      await search(page, "COMP4550");
      const card = palette(page).locator(".course-card").filter({ hasText: "COMP4550" });
      await card.waitFor();
      expect(await card.getByRole("button", { name: "Place in…" }).count()).toBe(1);
      await search(page, "COMP1130");
      const row = palette(page).locator(".placed-row").filter({ hasText: "COMP1130" });
      await row.waitFor();
      expect(await row.count()).toBe(1);
    });
  });

  it("a live-fetch outcome message shows", async () => {
    await withPlan(desktop, async (page) => {
      await page.route(/\/api\/courses\/search/, (route) =>
        route.fulfill({ json: { status: "not_found", courses: [] } }),
      );
      await openSearch(page);
      await search(page, "COMP9999");
      await expect
        .poll(() => palette(page).locator(".course-search-status").textContent())
        .toBe('No course found for "COMP9999". Check the code is correct.');
    });
  });

  it("ArrowDown moves into results, arrows move between them, Enter opens details", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, desktop, async (page) => {
      await openSearch(page);
      await search(page, "COMP11");
      await palette(page).locator(".placed-row").first().waitFor();
      const titles = palette(page).locator(".course-card-title, .placed-row-title");
      expect(await titles.count()).toBeGreaterThan(1);
      const focusedTitle = () =>
        page.evaluate(() => {
          const titles = [...document.querySelectorAll(".palette :is(.course-card-title, .placed-row-title)")];
          return titles.indexOf(document.activeElement!);
        });
      await page.locator(".palette input").focus();
      await page.keyboard.press("ArrowDown");
      expect(await focusedTitle()).toBe(0);
      await page.keyboard.press("ArrowDown");
      expect(await focusedTitle()).toBe(1);
      await page.keyboard.press("ArrowUp");
      expect(await focusedTitle()).toBe(0);
      const code = (await palette(page).locator(".course-card-code, .placed-row-code").first().textContent())!.trim();
      await page.keyboard.press("Enter");
      await expect.poll(() => palette(page).count()).toBe(0);
      await expect.poll(() => detailsPanel(page).locator("h2").textContent()).toContain(code);
      await expect.poll(() => new URL(page.url()).searchParams.get("course")).toBe(code);
    });
  });

  // Full screen on a phone leaves no backdrop to tap and no Escape key.
  it.each([desktop, phone])("a 44px close button closes it at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      await openSearch(page);
      const close = palette(page).getByRole("button", { name: "Close search" });
      const box = (await close.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await close.click();
      await expect.poll(() => palette(page).count()).toBe(0);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.classList.contains("search-trigger") ?? false))
        .toBe(true);
    });
  });

  it("fills the screen on a phone", async () => {
    await withPlan(phone, async (page) => {
      await openSearch(page);
      const box = (await palette(page).boundingBox())!;
      expect(box).toEqual({ x: 0, y: 0, width: phone.width, height: phone.height });
    });
  });

  it.each([desktop, phone])("is clean under axe with the palette open at $width×$height", async (viewport) => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, viewport, async (page) => {
      await openSearch(page);
      await search(page, "COMP11");
      await palette(page).locator(".placed-row").first().waitFor();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});
