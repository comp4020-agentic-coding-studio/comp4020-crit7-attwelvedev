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

  // A button, not a field: styled as an input, it promised typing in place.
  it.each([
    [desktop, /^(⌘K|Ctrl K)$/],
    [phone, /^$/],
  ])("the trigger is an icon button, showing only the shortcut where there's a keyboard, at $width×$height", async (viewport, shown) => {
    await withPlan(viewport, async (page) => {
      const trigger = page.locator(".search-trigger");
      expect((await trigger.innerText()).trim()).toMatch(shown);
      expect(await trigger.getAttribute("title")).toMatch(/^Search courses/);
      const box = (await trigger.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeLessThanOrEqual(120);
    });
  });

  it("labels the palette's input with what it searches", async () => {
    await withPlan(desktop, async (page) => {
      await openSearch(page);
      expect(await page.getByLabel("Search courses by code or title").evaluate((el) => el.matches(".palette input"))).toBe(
        true,
      );
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

  it("scrolled results stay clear of the input's focus ring", async () => {
    await withPlan(desktop, async (page) => {
      await openSearch(page);
      await search(page, "COMP4");
      await palette(page).locator(".course-card").first().waitFor();
      await page.locator(".palette-results").evaluate((el) => el.scrollBy(0, 80));
      await page.locator(".palette input").focus();
      // The ring is a 2px outline 2px outside the input: probe its middle.
      const underRing = await page.locator(".palette input").evaluate((input) => {
        const r = input.getBoundingClientRect();
        return !!document.elementFromPoint(r.left + r.width / 2, r.bottom + 3)?.closest(".palette-results");
      });
      expect(underRing).toBe(false);
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

describe("dragging out of the search palette", { timeout: 30_000 }, () => {
  const inTerm = (page: Page, term: number, code: string) =>
    page.locator(`[data-term="${term}"] [data-placed="${code}"]`);
  const resultCard = (page: Page, code: string) => page.locator(`.palette [data-drag-code="${code}"]`);

  async function searchFor(page: Page, code: string): Promise<void> {
    await openSearch(page);
    await search(page, code);
    await resultCard(page, code).waitFor();
  }

  it("mouse-drag a palette result onto a term", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, desktop, async (page) => {
      await searchFor(page, "COMP4680");
      // force: the palette covers the term until the drag starts, and
      // dragTo's hit test would wait for it before ever moving the mouse.
      await resultCard(page, "COMP4680").dragTo(page.locator('section[data-term="4"]'), { force: true });
      await expect.poll(() => inTerm(page, 4, "COMP4680").count()).toBe(1);
      await expect.poll(() => palette(page).count()).toBe(0);
    });
  });

  it("the palette hides during a drag", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, desktop, async (page) => {
      await searchFor(page, "COMP4680");
      const card = resultCard(page, "COMP4680");
      const start = (await card.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + 20);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 + 30, start.y + 20, { steps: 4 });
      await expect
        .poll(() => page.locator(".palette-backdrop").evaluate((el) => getComputedStyle(el).visibility))
        .toBe("hidden");
      await page.mouse.up();
    });
  });

  it("touch-drag a palette result", async () => {
    const id = await planWithPlacement("COMP1130");
    const context = await browser.newContext({ viewport: phone, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await page.goto(new URL(`/plan/${id}`, baseUrl).href, { waitUntil: "networkidle" });
      const cdp = await context.newCDPSession(page);
      const touch = (type: string, x = 0, y = 0) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        } as never);
      await searchFor(page, "COMP4680");
      const card = (await resultCard(page, "COMP4680").boundingBox())!;
      await touch("touchStart", card.x + card.width / 2, card.y + 20);
      await page.waitForTimeout(450); // past touch-drag.ts's HOLD_MS
      await expect.poll(() => page.locator(".drag-ghost").count()).toBe(1);
      // Narrow timeline: bring term 4 on-screen mid-drag, sideways only; a
      // vertical page scroll here is undone by the next touch move.
      await page
        .locator('[data-term="4"]')
        .evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      const term = (await page.locator('[data-term="4"]').boundingBox())!;
      await touch("touchMove", term.x + term.width / 2, term.y + 40);
      await touch("touchMove", term.x + term.width / 2 + 4, term.y + 44);
      await touch("touchEnd");
      await expect.poll(() => inTerm(page, 4, "COMP4680").count()).toBe(1);
      await expect.poll(() => palette(page).count()).toBe(0);
    } finally {
      await context.close();
    }
  });

  // COMP2700 is outside a new plan's tree and hard-blocked from term 0
  // (S2-only), so only the search result knows why.
  it("a refused drop announces its reason", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(id, desktop, async (page) => {
      await searchFor(page, "COMP2700");
      await resultCard(page, "COMP2700").dragTo(page.locator('section[data-term="0"]'), { force: true });
      await expect.poll(() => page.locator('p[aria-live="polite"]').textContent()).not.toBe("");
      expect(await inTerm(page, 0, "COMP2700").count()).toBe(0);
      expect(await page.locator('[data-placed="COMP2700"]').count()).toBe(0);
    });
  });
});
