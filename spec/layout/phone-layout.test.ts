import { describe, expect, it } from "vitest";
import type { BrowserContext, Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow } from "../browser";
import { baseUrl, browser, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

const phone = { width: 390, height: 844 };

const tabbar = (page: Page) => page.getByRole("navigation", { name: "Plan view" });
const tab = (page: Page, name: "Timeline" | "Requirements") => tabbar(page).getByRole("button", { name, exact: true });
const requirements = (page: Page) => page.locator("aside#requirements");
const timeline = (page: Page) => page.locator(".planner-timeline-area");

// A touch-capable phone, driven through CDP: Playwright's own touchscreen
// only taps, and the planner's touch drag needs a hold, then moves.
async function onTouchPhone(url: string, check: (page: Page, touch: Touch) => Promise<void>): Promise<void> {
  const context: BrowserContext = await browser.newContext({ viewport: phone, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const cdp = await context.newCDPSession(page);
    const touch: Touch = (type, x = 0, y = 0) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] } as never);
    await check(page, touch);
  } finally {
    await context.close();
  }
}
type Touch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number) => Promise<unknown>;

// Below the phone threshold one region shows at a time, picked from a
// floating tab bar (WR43); it replaces the stacked split and its bar.
describe("phone tabs", { timeout: 30_000 }, () => {
  it("one region at a time", async () => {
    await withPlan(phone, async (page) => {
      await tabbar(page).waitFor();
      for (const name of ["Timeline", "Requirements"] as const) {
        const box = (await tab(page, name).boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(await tab(page, "Timeline").getAttribute("aria-pressed")).toBe("true");
      expect(await tab(page, "Requirements").getAttribute("aria-pressed")).toBe("false");
      expect(await timeline(page).isVisible()).toBe(true);
      expect(await requirements(page).evaluate((el) => getComputedStyle(el).display)).toBe("none");

      await tab(page, "Requirements").click();
      expect(await tab(page, "Requirements").getAttribute("aria-pressed")).toBe("true");
      expect(await tab(page, "Timeline").getAttribute("aria-pressed")).toBe("false");
      expect(await requirements(page).isVisible()).toBe(true);
      expect(await timeline(page).evaluate((el) => getComputedStyle(el).display)).toBe("none");
    });
  });

  // Each region gets the whole planner, less nothing: the bar floats over it.
  it("each region takes the full planner height", async () => {
    await withPlan(phone, async (page) => {
      const fills = (selector: string) =>
        page.evaluate((s) => {
          const panes = document.querySelector(".planner-panes")!.getBoundingClientRect();
          const region = document.querySelector(s)!.getBoundingClientRect();
          return Math.abs(region.top - panes.top) <= 1 && Math.abs(region.bottom - panes.bottom) <= 1;
        }, selector);
      await tabbar(page).waitFor();
      expect(await fills(".planner-timeline-area")).toBe(true);
      await tab(page, "Requirements").click();
      expect(await fills("aside#requirements")).toBe(true);
    });
  });

  it.each([
    ["by default", {}],
    ["with the requirements folded on a wider screen", { "panel-reqs": "collapsed" }],
  ])("no split handle or collapsed bar on phones %s", async (_state, storage) => {
    const page = await openPage(browser, planUrl(), phone, { storage });
    try {
      await tabbar(page).waitFor();
      for (const name of ["Timeline", "Requirements"] as const) {
        await tab(page, name).click();
        expect(await page.locator('[role="separator"]').count()).toBe(0);
        expect(await page.locator(".reqs-rail").isVisible()).toBe(false);
        expect(await page.locator(".reqs-hide").isVisible()).toBe(false);
      }
      // The saved fold doesn't apply here: the Requirements tab shows them.
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(true);
    } finally {
      await page.close();
    }
  });

  // Outside side by side the requirements used to be a sideways strip;
  // with the whole screen they read as a list.
  it("lists the requirements vertically", async () => {
    await withPlan(phone, async (page) => {
      await tab(page, "Requirements").click();
      const layout = await page.evaluate(() => {
        const aside = document.querySelector<HTMLElement>("aside#requirements")!;
        const groups = [...document.querySelectorAll(".requirements-scroll > li")].map((el) =>
          el.getBoundingClientRect(),
        );
        return {
          sideways: aside.scrollWidth - aside.clientWidth,
          stacked: groups.every((g, i) => i === 0 || g.top >= groups[i - 1].bottom - 1),
          scrolls: aside.scrollHeight > aside.clientHeight,
        };
      });
      expect(layout.sideways).toBeLessThanOrEqual(0);
      expect(layout.stacked).toBe(true);
      expect(layout.scrolls).toBe(true);
    });
  });

  it("jumps switch tabs", async () => {
    await withPlan(phone, async (page) => {
      await tabbar(page).waitFor();
      const allocation = page.locator('[data-placed="COMP2620"] .course-card-allocation');
      await allocation.scrollIntoViewIfNeeded();
      await allocation.click();
      await expect.poll(() => tab(page, "Requirements").getAttribute("aria-pressed")).toBe("true");
      const highlighted = () =>
        page.locator(".requirement-highlighted").evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
      await expect.poll(highlighted).toEqual(["arin-a"]);
      const inView = () =>
        page.evaluate(() => {
          const g = document.querySelector('[data-group="arin-a"]')!.getBoundingClientRect();
          const a = document.querySelector("aside#requirements")!.getBoundingClientRect();
          return g.bottom > a.top && g.top < a.bottom;
        });
      await expect.poll(inView).toBe(true);

      const row = page.locator("aside#requirements .placed-row .course-card-term-link").first();
      const code = await row.evaluate((el) => el.closest(".placed-row")!.querySelector(".placed-row-code")!.textContent);
      await row.click();
      await expect.poll(() => tab(page, "Timeline").getAttribute("aria-pressed")).toBe("true");
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-placed"))).toBe(code);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  // A requirement option can still be dragged onto a semester (WR45): the
  // drag starts on the Requirements tab and the Timeline takes over as soon
  // as it arms, so the finger ends up over the terms.
  it("a touch drag from Requirements switches to the Timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    await onTouchPhone(new URL(`/plan/${id}`, baseUrl).href, async (page, touch) => {
      await tab(page, "Requirements").click();
      const card = page.locator('aside#requirements [data-drag-code="COMP3630"]').first();
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      await touch("touchStart", box.x + box.width / 2, box.y + 20);
      await page.waitForTimeout(450); // past touch-drag.ts's HOLD_MS
      await expect.poll(() => page.locator(".drag-ghost").count()).toBe(1);
      await expect.poll(() => tab(page, "Timeline").getAttribute("aria-pressed")).toBe("true");
      expect(await timeline(page).isVisible()).toBe(true);

      const term = Number(await page.locator("[data-term]:not(.term-disallowed)").first().getAttribute("data-term"));
      await page
        .locator(`[data-term="${term}"]`)
        .evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      const target = (await page.locator(`[data-term="${term}"]`).boundingBox())!;
      await touch("touchMove", target.x + target.width / 2, target.y + 60);
      await touch("touchMove", target.x + target.width / 2 + 4, target.y + 64);
      await touch("touchEnd");
      await expect.poll(() => page.locator(`[data-term="${term}"] [data-placed="COMP3630"]`).count()).toBe(1);
    });
  });

  it.each([
    ["shown", {}],
    ["hidden", { "panel-nav": "hidden" }],
  ])("fitted page on both tabs with the nav %s", async (_state, storage) => {
    const page = await openPage(browser, planUrl(), phone, { storage });
    try {
      for (const name of ["Timeline", "Requirements"] as const) {
        await tab(page, name).click();
        expect(await verticalOverflow(page)).toBe(0);
        expect(await horizontalOverflow(page)).toBe(0);
      }
    } finally {
      await page.close();
    }
  });

  it("axe on each tab", async () => {
    await withPlan(phone, async (page) => {
      for (const name of ["Timeline", "Requirements"] as const) {
        await tab(page, name).click();
        expect(await axeViolations(page), name).toEqual([]);
      }
    });
  });

  it("undo toast sits above the tab bar", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, phone);
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      await card.getByRole("button", { name: "More options for COMP1130" }).click();
      await card.getByRole("button", { name: "Remove", exact: true }).click();
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      const toastBox = (await toast.boundingBox())!;
      const barBox = (await tabbar(page).boundingBox())!;
      expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y);
    } finally {
      await page.close();
    }
  });
});
