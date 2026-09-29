import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow, type Viewport } from "../browser";
import { baseUrl, browser, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

describe("plan page fits the screen", { timeout: 30_000 }, () => {
  it.each([
    [1920, 1080, {}],
    [1440, 900, {}],
    [1280, 800, {}],
    [1100, 800, {}],
    [900, 800, {}],
    [800, 800, {}],
    [390, 844, {}],
    [1920, 1080, { "panel-nav": "hidden" }],
    [900, 800, { "panel-nav": "hidden" }],
    [390, 844, { "panel-nav": "hidden" }],
    [1920, 1080, { "panel-reqs": "collapsed" }],
    [900, 800, { "panel-reqs": "collapsed" }],
    [390, 844, { "panel-reqs": "collapsed" }],
    [390, 844, { "panel-reqs": "collapsed", "panel-nav": "hidden" }],
    [390, 844, { "panel-split": "30" }],
    [390, 844, { "panel-split": "70" }],
    [390, 844, { "panel-split": "70", "panel-nav": "hidden" }],
  ])("at %i×%i with %o the page doesn't scroll either way",async (width, height, storage) => {
    const page = await openPage(browser, planUrl(), { width, height }, { storage });
    try {
      expect(await verticalOverflow(page)).toBe(0);
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [900, 800],
  ])("at %i×%i the side-by-side panes run to the bottom of the planner", async (width, height) => {
    const geometry = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const a = rect("aside");
        const t = rect(".planner-timeline-area");
        const p = rect(".planner-panes");
        return {
          topGap: Math.abs(a.top - t.top),
          asideGap: Math.abs(a.bottom - p.bottom),
          timelineGap: Math.abs(t.bottom - p.bottom),
          panesGap: Math.abs(p.bottom - (innerHeight - parseFloat(getComputedStyle(document.querySelector("main")!).paddingBottom))),
        };
      }),
    );
    expect(geometry.topGap).toBeLessThanOrEqual(1);
    expect(geometry.asideGap).toBeLessThanOrEqual(1);
    expect(geometry.timelineGap).toBeLessThanOrEqual(1);
    expect(geometry.panesGap).toBeLessThanOrEqual(1);
  });

  // .timeline-scroll is the timeline's only vertical scroller (the region
  // around it doesn't scroll, so its sticky year heads have one scroller to
  // stick to), and it ends at the bottom of the tallest semester column —
  // the prereq overlay mustn't pad it out (it used to size itself from a
  // scrollHeight it was part of).
  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the timeline scrolls vertically once, to the bottom of the columns", async (width, height) => {
    const result = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        const area = document.querySelector<HTMLElement>(".planner-timeline-area")!;
        const scroll = document.querySelector<HTMLElement>(".timeline-scroll")!;
        const svg = document.querySelector(".prereq-overlay")!;
        const top = scroll.getBoundingClientRect().top;
        const columnsBottom = Math.max(
          ...[...scroll.querySelectorAll(".term")].map((t) => t.getBoundingClientRect().bottom - top),
        );
        const padding = parseFloat(getComputedStyle(scroll).paddingBottom);
        return {
          outerOverflowY: getComputedStyle(area).overflowY,
          outerExtra: area.scrollHeight - area.clientHeight,
          scrollExtra: scroll.scrollHeight - columnsBottom - padding,
          svgExtra: svg.getBoundingClientRect().height - columnsBottom - padding,
        };
      }),
    );
    expect(result.outerOverflowY).toBe("hidden");
    expect(result.outerExtra).toBeLessThanOrEqual(0);
    expect(result.scrollExtra).toBeLessThanOrEqual(1);
    expect(result.svgExtra).toBeLessThanOrEqual(1);
  });

  // 800px tall, not 1080: shorter cards let the example's timeline fit a
  // 1080px pane, leaving nothing to scroll. The overflow preconditions make
  // the test fail loudly, not pass vacuously, if that happens again.
  it("scrolls each pane on its own while the title stays put", async () => {
    const result = await withPlan({ width: 1920, height: 800 }, (page) =>
      page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const aside = document.querySelector<HTMLElement>("aside")!;
        const timeline = document.querySelector<HTMLElement>(".timeline-scroll")!;
        const overflows = {
          aside: aside.scrollHeight > aside.clientHeight,
          timeline: timeline.scrollHeight > timeline.clientHeight,
        };
        const titleTop = rect("h1").top;
        aside.scrollTop = 300;
        const afterAside = {
          aside: aside.scrollTop,
          timeline: timeline.scrollTop,
          page: document.scrollingElement!.scrollTop,
          titleMoved: rect("h1").top !== titleTop,
        };
        timeline.scrollTop = 300;
        return { overflows, afterAside, afterTimeline: { aside: aside.scrollTop, timeline: timeline.scrollTop } };
      }),
    );
    expect(result.overflows).toEqual({ aside: true, timeline: true });
    expect(result.afterAside.aside).toBeGreaterThan(0);
    expect(result.afterAside.timeline).toBe(0);
    expect(result.afterAside.page).toBe(0);
    expect(result.afterAside.titleMoved).toBe(false);
    expect(result.afterTimeline.timeline).toBeGreaterThan(0);
    expect(result.afterTimeline.aside).toBe(result.afterAside.aside);
  });

  it("stretches the collapsed rail to the bottom of the planner", async () => {
    const page = await openPage(browser, planUrl(), { width: 1920, height: 1080 }, {
      storage: { "panel-reqs": "collapsed" },
    });
    try {
      const gaps = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const aside = rect("aside");
        return {
          rail: Math.abs(rect(".reqs-rail").bottom - aside.bottom),
          timeline: Math.abs(aside.bottom - rect(".planner-timeline-area").bottom),
        };
      });
      expect(gaps.rail).toBeLessThanOrEqual(1);
      expect(gaps.timeline).toBeLessThanOrEqual(1);
    } finally {
      await page.close();
    }
  });

  it.each([
    ["shown", {}],
    ["hidden", { "panel-nav": "hidden" }],
  ])("on a phone with the nav %s the timeline and requirements split the height", async (_state, storage) => {
    const page = await openPage(browser, planUrl(), { width: 390, height: 844 }, { storage });
    try {
      const split = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const p = rect(".planner-panes");
        const t = rect(".planner-timeline-area");
        const a = rect("aside");
        return {
          timelineAtMostHalf: t.height <= p.height / 2 + 1,
          asideBelow: a.top >= t.bottom,
          asideGap: Math.abs(a.bottom - p.bottom),
          asideAtLeastHalf: a.height >= p.height / 2 - 17,
        };
      });
      expect(split.timelineAtMostHalf).toBe(true);
      expect(split.asideBelow).toBe(true);
      expect(split.asideGap).toBeLessThanOrEqual(1);
      expect(split.asideAtLeastHalf).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("keeps the page scrolling with sticky panes on a landscape phone", async () => {
    const page = await openPage(browser, planUrl(), { width: 844, height: 390 });
    try {
      expect(await page.evaluate(() => getComputedStyle(document.querySelector("aside")!).position)).toBe("sticky");
      expect(await verticalOverflow(page)).toBeGreaterThan(0);
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });
});

describe("card height budget", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };

  it("the median timeline card is at most 150px tall at 1920×1080", async () => {
    await withPlan(desktop, async (page) => {
      const heights = await page.$$eval(".term-cards .course-card", (cards) =>
        cards.map((card) => card.getBoundingClientRect().height).sort((a, b) => a - b),
      );
      // More than a handful, so an empty or near-empty selection can't pass.
      expect(heights.length).toBeGreaterThan(10);
      const mid = Math.floor(heights.length / 2);
      const median = heights.length % 2 ? heights[mid] : (heights[mid - 1] + heights[mid]) / 2;
      expect(median, `sorted heights: ${heights.map((h) => h.toFixed(1)).join(", ")}`).toBeLessThanOrEqual(150);
    });
  });

  // The phone pane has about 215px below its first term's header. Half the
  // second card didn't fit even with every spacing lever at its floor (the
  // first card's title and "Counts toward" wrap to three lines each, and card
  // text is never clamped), so the budget is one full card plus the next
  // one's code line: enough to show another course follows (ruled 2026-09-28).
  // The sticky year band (workspace-redesign Task 15) took about 30px more,
  // and the user relaxed the budget to the first card alone until Phase 07's
  // tabs give the phone timeline the whole screen (ruled 2026-09-29). Phase
  // 07 restores the second card's code line.
  it("the first card fits in the timeline pane at 390×844 (the second's code line returns in Phase 07)", async () => {
    await withPlan(phone, async (page) => {
      const { area, cards } = await page.evaluate(() => {
        const rect = (el: Element) => {
          const { top, bottom } = el.getBoundingClientRect();
          return { top, bottom };
        };
        return {
          area: rect(document.querySelector(".planner-timeline-area")!),
          cards: [...document.querySelectorAll('[data-term="0"] .term-cards .course-card')].map((card) => ({
            card: rect(card),
            head: rect(card.querySelector(".course-card-head")!),
          })),
        };
      });
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const [a, b] = cards;
      const detail = `area ${JSON.stringify(area)}, first ${JSON.stringify(a.card)}, second head ${JSON.stringify(b.head)}`;
      expect(a.card.top, detail).toBeGreaterThanOrEqual(area.top);
      expect(a.card.bottom, detail).toBeLessThanOrEqual(area.bottom);
      expect(b.head.top, detail).toBeGreaterThanOrEqual(a.card.bottom);
    });
  });
});

describe("plan title row", { timeout: 60_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };

  interface Box {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }
  const centre = (box: Box) => (box.top + box.bottom) / 2;
  const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  // Rects of the title row's parts, plus the h1's text (not its padded box).
  function rowRects(page: Page) {
    return page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const { top, bottom, left, right } = el.getBoundingClientRect();
        return { top, bottom, left, right };
      };
      const h1 = document.querySelector("h1")!;
      const range = document.createRange();
      range.selectNodeContents(h1);
      const text = range.getBoundingClientRect();
      return {
        h1: box(h1)!,
        h1Text: { top: text.top, bottom: text.bottom, left: text.left, right: text.right },
        note: box(document.querySelector('[role="note"]')),
        readout: box(document.querySelector(".completed-toggle, .completed-readout")),
        more: box(document.querySelector(".more-options-toggle")),
        row: box(document.querySelector(".plan-title")),
        actions: box(document.querySelector(".plan-actions")),
        area: box(document.querySelector(".planner-timeline-area"))!,
        term: box(document.querySelector(".term"))!,
        band: box(document.querySelector(".timeline-year-head"))!,
        tab: box(document.querySelector("button.nav-show")),
      };
    });
  }

  async function onPlan<T>(path: string, viewport: Viewport, check: (page: Page) => Promise<T>, options = {}) {
    const page = await openPage(browser, new URL(path, baseUrl).href, viewport, options);
    try {
      return await check(page);
    } finally {
      await page.close();
    }
  }

  it("puts a 1.4rem title, the badge and the controls on one row at 1920", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontSize)).toBe("22.4px");
      expect(await page.locator('[role="note"]').textContent()).toBe("This is an example — Start your own plan");
      const r = await rowRects(page);
      expect(Math.abs(centre(r.note!) - centre(r.h1))).toBeLessThanOrEqual(4);
      expect(r.h1.right).toBeLessThan(r.note!.left);
      expect(Math.abs(centre(r.readout!) - centre(r.h1))).toBeLessThanOrEqual(4);
      expect(Math.abs(centre(r.more!) - centre(r.h1))).toBeLessThanOrEqual(4);
      expect(Math.abs(r.more!.right - r.row!.right)).toBeLessThanOrEqual(1);
    });
  });

  it.each(["/help/", "/readme/", "/"])("leaves %s's h1 at its document size", async (path) => {
    await onPlan(path, desktop, async (page) => {
      expect(await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontSize)).toBe("33.6px");
    });
  });

  // The year band is the timeline's own head, so it's what starts at the
  // region's top, with the first term right under it (ruled 2026-09-29).
  it("leaves nothing above the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    for (const viewport of [desktop, phone]) {
      for (const path of ["/plan/example", `/plan/${id}`]) {
        await onPlan(path, viewport, async (page) => {
          const r = await rowRects(page);
          expect(r.band.top - r.area.top, `${path} at ${viewport.width}`).toBeLessThanOrEqual(4);
          expect(r.term.top - r.band.bottom, `${path} at ${viewport.width}`).toBeLessThanOrEqual(1);
          expect(await page.locator(".cutoff-controls").count()).toBe(0);
        });
      }
    }
  });

  // Each limit is the one ruled before the year band, plus the band: 44px
  // where the ‹ › buttons ride it, 30px on a phone, which has none
  // (ruled 2026-09-29).
  it("gives the height back to the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    const limits = [
      [desktop, "/plan/example", 64 + 44],
      [desktop, `/plan/${id}`, 64 + 44],
      [phone, "/plan/example", 125 + 30],
      [phone, `/plan/${id}`, 100 + 30],
    ] as const;
    for (const [viewport, path, limit] of limits) {
      await onPlan(path, viewport, async (page) => {
        const r = await rowRects(page);
        expect(r.term.top - r.h1.top, `${path} at ${viewport.width}`).toBeLessThanOrEqual(limit);
        expect(await horizontalOverflow(page)).toBe(0);
        expect(await verticalOverflow(page)).toBe(0);
      });
    }
  });

  it("wraps the controls onto their own line on a phone", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(`/plan/${id}`, phone, async (page) => {
      const r = await rowRects(page);
      expect(r.actions!.top).toBeGreaterThanOrEqual(r.h1.bottom);
      expect(Math.abs(r.actions!.right - r.row!.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(centre(r.more!) - centre(r.readout!))).toBeLessThanOrEqual(4);
    });
    await withPlan(phone, async (page) => {
      const r = await rowRects(page);
      expect(r.note!.top).toBeGreaterThanOrEqual(r.h1.bottom);
      expect(r.actions!.top).toBeGreaterThanOrEqual(r.note!.bottom);
    });
  });

  it("keeps the nav tab clear of the title and badge on a phone", async () => {
    await onPlan(
      "/plan/example",
      phone,
      async (page) => {
        const r = await rowRects(page);
        expect(intersects(r.tab!, r.note!)).toBe(false);
        expect(intersects(r.tab!, r.h1Text)).toBe(false);
        expect(await horizontalOverflow(page)).toBe(0);
        expect(await verticalOverflow(page)).toBe(0);
      },
      { storage: { "panel-nav": "hidden" } },
    );
  });

  it("is clean under axe", async () => {
    const id = await planWithPlacement("COMP1130");
    for (const path of ["/plan/example", `/plan/${id}`]) {
      await onPlan(path, desktop, async (page) => {
        expect(await axeViolations(page)).toEqual([]);
      });
    }
  });

  it.each([
    [390, 844],
    [1920, 1080],
  ])("at %i×%i changing the completed semesters doesn't move the controls", async (width, height) => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(`/plan/${id}`, { width, height }, async (page) => {
      const boxes = () =>
        page.evaluate(() =>
          [".completed-toggle", ".more-options-toggle"].map((selector) => {
            const { left, top, right } = document.querySelector(selector)!.getBoundingClientRect();
            return { left, top, right };
          }),
        );
      const before = await boxes();
      await page.locator(".completed-toggle").click();
      await page.locator(".completed-panel").getByRole("button", { name: "S1 2029" }).click();
      await expect.poll(async () => Number(await page.locator(".planner").getAttribute("data-cutoff"))).toBe(5);
      const after = await boxes();
      after.forEach((box, i) => {
        expect(Math.abs(box.left - before[i].left)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.right - before[i].right)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.top - before[i].top)).toBeLessThanOrEqual(1);
      });
    });
  });

  it("Help says the control sits beside the title", async () => {
    await onPlan("/help/", desktop, async (page) => {
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toMatch(/beside the plan's title/i);
      expect(text).not.toContain("Above the timeline");
    });
  });
});

describe("more options", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const moreOptions = (page: Page) => page.getByRole("button", { name: "More options", exact: true });
  const prereqToggle = (page: Page) => page.getByLabel("Show prerequisite links");

  async function withFreshPlan(viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("opens, stays open while used, and Escape closes it back onto the button", async () => {
    await withFreshPlan(desktop, async (page) => {
      const more = moreOptions(page);
      const copy = page.getByRole("button", { name: "Copy plan link" });
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      const controls = await more.getAttribute("aria-controls");
      expect(await page.locator(`#${controls}`).count()).toBe(1);
      expect(await prereqToggle(page).isVisible()).toBe(false);
      expect(await copy.isVisible()).toBe(false);

      await more.click();
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      expect(await prereqToggle(page).isVisible()).toBe(true);
      expect(await copy.isVisible()).toBe(true);

      await prereqToggle(page).check();
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      expect(await prereqToggle(page).isChecked()).toBe(true);

      await page.keyboard.press("Escape");
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("More options");
    });
  });

  it("a press outside closes it", async () => {
    await withFreshPlan(desktop, async (page) => {
      const more = moreOptions(page);
      await more.click();
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      await page.locator("h1").click();
      expect(await more.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("shares one open menu with the course menus", async () => {
    await withFreshPlan(desktop, async (page) => {
      const more = moreOptions(page);
      const cardMenu = page.getByRole("button", { name: "More options for COMP1130" });
      await more.click();
      await cardMenu.click();
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("true");
      await more.click();
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("false");
      expect(await more.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // A press on the card itself counts as outside: that's where a drag
  // starts, and an open menu shouldn't ride along under the pointer.
  it("a press outside a course's menu closes it, even on its own card", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      const cardMenu = card.getByRole("button", { name: "More options for COMP1130" });
      await cardMenu.click();
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("true");
      await card.locator(".course-card-code").click();
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("false");

      await cardMenu.click();
      // A press inside the panel, on its (non-interactive) heading.
      await card.locator(".card-menu-heading").click();
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("true");
      await page.locator("h1").click();
      expect(await cardMenu.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("offers only the prerequisite toggle on a read-only plan", async () => {
    await withPlan(desktop, async (page) => {
      await moreOptions(page).click();
      expect(await prereqToggle(page).isVisible()).toBe(true);
      expect(await page.getByRole("button", { name: "Copy plan link" }).count()).toBe(0);
    });
  });

  it("the open panel fits on a phone", async () => {
    await withFreshPlan({ width: 390, height: 844 }, async (page) => {
      await moreOptions(page).click();
      const panel = await page.evaluate(() => {
        const r = document.querySelector(".more-options-panel")!.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      expect(panel.left).toBeGreaterThanOrEqual(0);
      expect(panel.right).toBeLessThanOrEqual(390);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("is clean under axe with the panel open", async () => {
    await withFreshPlan(desktop, async (page) => {
      await moreOptions(page).click();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});
