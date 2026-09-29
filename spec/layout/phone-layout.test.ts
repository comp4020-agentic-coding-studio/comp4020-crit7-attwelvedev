import { describe, expect, it } from "vitest";
import type { BrowserContext, Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow } from "../browser";
import { PEEK_PX } from "../../src/components/sheet-detent";
import { baseUrl, browser, detailsHeadEnd, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

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

// On a phone, details open as a bottom sheet over the plan, at a peek,
// half or full height (WR44), and Remove works from it (WR45).
describe("details sheet", { timeout: 30_000 }, () => {
  const sheet = (page: Page) => page.locator('aside[aria-label="Course details"]');
  const handle = (page: Page) => sheet(page).getByRole("slider", { name: "Resize details" });
  const detent = (page: Page) => sheet(page).getAttribute("data-detent");
  // Once the height has finished easing to where it's going.
  const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0);

  async function withOpenSheet(check: (page: Page, touch: Touch) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    await onTouchPhone(new URL(`/plan/${id}`, baseUrl).href, async (page, touch) => {
      await page.getByRole("button", { name: "Programming as Problem Solving (Advanced), details" }).click();
      await sheet(page).waitFor();
      await settled(page);
      await check(page, touch);
    });
  }

  // What's on top at the middle of the tab bar's Requirements button.
  const tabOnTop = (page: Page) =>
    page.evaluate(() => {
      const button = [...document.querySelectorAll(".tabbar button")].find((b) => b.textContent === "Requirements")!;
      const r = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });

  // Where the sheet lies, against the region under it.
  const edges = (page: Page) =>
    page.evaluate(() => {
      const box = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { left: r.left, right: innerWidth - r.right, top: r.top, bottom: innerHeight - r.bottom, height: r.height };
      };
      return { sheet: box('aside[aria-label="Course details"]'), region: box(".planner-timeline-area") };
    });

  it("opens at half height on the region's edges, under the tab bar, which stays usable", async () => {
    await withOpenSheet(async (page) => {
      expect(await sheet(page).getAttribute("data-mode")).toBe("sheet");
      expect(await detent(page)).toBe("half");
      const { sheet: s, region: r } = await edges(page);
      expect(Math.abs(s.left - r.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.right - r.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.bottom - r.bottom)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.height - 0.56 * 844)).toBeLessThanOrEqual(1);
      expect(await tabOnTop(page)).toBe(true);
      // The last section scrolls out from under the bar.
      const clear = await sheet(page).evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        const last = el.querySelector(".details-footer") ?? el.lastElementChild!;
        return last.getBoundingClientRect().bottom <= document.querySelector(".tabbar")!.getBoundingClientRect().top;
      });
      expect(clear).toBe(true);
      await tab(page, "Requirements").click();
      expect(await tab(page, "Requirements").getAttribute("aria-pressed")).toBe("true");
      expect(await sheet(page).isVisible()).toBe(true);
    });
  });

  it("a tap on the handle cycles its heights: header only at peek, over the tab bar at full", async () => {
    await withOpenSheet(async (page) => {
      const head = sheet(page).locator(".details-head");
      const body = sheet(page).locator(".details-body");

      await handle(page).click();
      await settled(page);
      expect(await detent(page)).toBe("full");
      const { sheet: full } = await edges(page);
      for (const side of ["left", "right", "top", "bottom"] as const) {
        expect(Math.abs(full[side] - 8), side).toBeLessThanOrEqual(1);
      }
      expect(await tabOnTop(page)).toBe(false);

      await handle(page).click();
      await settled(page);
      expect(await detent(page)).toBe("peek");
      expect(Math.abs((await sheet(page).boundingBox())!.height - PEEK_PX)).toBeLessThanOrEqual(1);
      expect(await body.isVisible()).toBe(false);
      expect(await head.isVisible()).toBe(true);
      // The peek says which course it is: its code and title, uncut and
      // clear of the tab bar over its foot, and no half-shown row below.
      const cut = await sheet(page).evaluate((el) => {
        const bar = document.querySelector(".tabbar")!.getBoundingClientRect().top;
        const h2 = el.querySelector(".details-head h2")!.getBoundingClientRect();
        return { title: h2.bottom <= bar, overflow: el.scrollHeight - el.clientHeight };
      });
      expect(cut.title).toBe(true);
      expect(cut.overflow).toBeLessThanOrEqual(1);

      await handle(page).click();
      await settled(page);
      expect(await detent(page)).toBe("half");
      expect(await body.isVisible()).toBe(true);
      expect(await tabOnTop(page)).toBe(true);
    });
  });

  it("dragging the handle from half to near the top settles at full", async () => {
    await withOpenSheet(async (page, touch) => {
      const box = (await handle(page).boundingBox())!;
      const x = box.x + box.width / 2;
      await touch("touchStart", x, box.y + box.height / 2);
      await touch("touchMove", x, box.y - 100);
      await touch("touchMove", x, 60);
      // It follows the finger before it settles.
      expect((await sheet(page).boundingBox())!.y).toBeLessThan(box.y - 100);
      await touch("touchMove", x, 30);
      await touch("touchEnd");
      await expect.poll(() => detent(page)).toBe("full");
    });
  });

  it("a short drag down from half settles back at half, a long one at peek", async () => {
    await withOpenSheet(async (page, touch) => {
      const drag = async (dy: number) => {
        const box = (await handle(page).boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await touch("touchStart", x, y);
        await touch("touchMove", x, y + dy / 2);
        await touch("touchMove", x, y + dy);
        await touch("touchEnd");
        await settled(page);
      };
      await drag(40);
      expect(await detent(page)).toBe("half");
      await drag(300);
      expect(await detent(page)).toBe("peek");
    });
  });

  it("Remove from plan in the sheet removes the course and offers Undo, leaving the sheet open", async () => {
    await withOpenSheet(async (page) => {
      await sheet(page).getByRole("button", { name: "Remove from plan" }).click();
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      expect(await toast.getByRole("button", { name: "Undo" }).count()).toBe(1);
      await expect.poll(() => page.locator('[data-placed="COMP1130"]').count()).toBe(0);
      expect(await sheet(page).isVisible()).toBe(true);
      expect(await sheet(page).locator(".details-pills").textContent()).toContain("Not in your plan");
    });
  });

  it("the handle is a 44px slider that says its height, and steps from the keyboard", async () => {
    await withOpenSheet(async (page) => {
      const h = handle(page);
      const box = (await h.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(await h.getAttribute("aria-valuetext")).toBe("Half height");
      expect(await h.getAttribute("aria-orientation")).toBe("vertical");
      await h.focus();
      await page.keyboard.press("ArrowUp");
      await expect.poll(() => h.getAttribute("aria-valuetext")).toBe("Full height");
      await page.keyboard.press("ArrowUp");
      expect(await h.getAttribute("aria-valuetext")).toBe("Full height");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => h.getAttribute("aria-valuetext")).toBe("Peek");
      expect(await detent(page)).toBe("peek");
    });
  });

  // At full height the dark site nav lies behind the header's top.
  it("backs its frosted header with its own white, edge to edge", async () => {
    await withOpenSheet(async (page) => {
      await handle(page).click();
      await expect.poll(() => detent(page)).toBe("full");
      await settled(page);
      const [r, g, b] = await detailsHeadEnd(page);
      expect(Math.min(r, g, b), `rgb(${r}, ${g}, ${b})`).toBeGreaterThan(230);
    });
  });

  // Its white scrolls with it (a local background, for the frosted
  // header), so an elastic overscroll would pull it off the page behind.
  it("doesn't rubber-band past its ends", async () => {
    await withOpenSheet(async (page) => {
      expect(await sheet(page).evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe("none");
    });
  });

  it("Escape inside the sheet closes it", async () => {
    await withOpenSheet(async (page) => {
      await handle(page).focus();
      await page.keyboard.press("Escape");
      await expect.poll(() => sheet(page).count()).toBe(0);
    });
  });

  it("opens each new course at half height", async () => {
    await withOpenSheet(async (page) => {
      await handle(page).click();
      await expect.poll(() => detent(page)).toBe("full");
      await sheet(page).getByRole("button", { name: "Close details" }).click();
      await page.getByRole("button", { name: "Programming as Problem Solving (Advanced), details" }).click();
      await expect.poll(() => detent(page)).toBe("half");
    });
  });

  it("axe at each height", async () => {
    await withOpenSheet(async (page) => {
      for (const height of ["half", "full", "peek"]) {
        await expect.poll(() => detent(page)).toBe(height);
        await settled(page);
        expect(await axeViolations(page), height).toEqual([]);
        await handle(page).click();
      }
    });
  });

  it("eases between heights over 250ms, instantly under reduced motion", async () => {
    await withOpenSheet(async (page) => {
      const transition = () =>
        sheet(page).evaluate((el) => {
          const style = getComputedStyle(el);
          const props = style.transitionProperty.split(", ");
          return style.transitionDuration.split(", ")[props.indexOf("height")] ?? null;
        });
      expect(await transition()).toBe("0.25s");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await transition()).toBe("0s");
    });
  });
});
