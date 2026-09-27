import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { Browser, Page } from "playwright";
import { axeViolations, horizontalOverflow, launch, openPage, verticalOverflow, type Viewport } from "./browser";
import { ROUTES } from "./routes";

const baseUrl = inject("baseUrl");
let browser: Browser;
beforeAll(async () => {
  browser = await launch();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

const planUrl = () => new URL("/plan/example", baseUrl).href;

async function withPlan<T>(viewport: Viewport, check: (page: Page) => Promise<T>): Promise<T> {
  const page = await openPage(browser, planUrl(), viewport);
  try {
    return await check(page);
  } finally {
    await page.close();
  }
}

// Creates an editable plan with `code` placed in term 0 and returns its id.
async function planWithPlacement(code: string): Promise<string> {
  const created = await fetch(new URL("/api/plans", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    redirect: "manual",
  });
  const id = created.headers.get("location")!.split("/").pop()!;
  const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ code, term: 0 }),
  });
  expect(placed.status).toBe(200);
  return id;
}

describe("layout", { timeout: 30_000 }, () => {
  it("the plan page doesn't scroll sideways on a phone", async () => {
    const page = await openPage(browser, new URL("/plan/example", baseUrl).href, { width: 390, height: 844 });
    expect(await horizontalOverflow(page)).toBe(0);
    await page.close();
  });

  it.each([
    [1920, 1080],
    [1440, 900],
    [1280, 800],
    [1100, 800],
    [900, 800],
    [800, 800],
  ])("the plan page doesn't scroll sideways at %i×%i", async (width, height) => {
    expect(await withPlan({ width, height }, horizontalOverflow)).toBe(0);
  });

  it.each([
    [1920, 1080, "side-by-side", 715],
    [1440, 900, "side-by-side", 498],
    [1100, 800, "side-by-side", 280],
    [900, 800, "side-by-side", 280],
    [800, 800, "stacked", null],
    [390, 844, "stacked", null],
  ])("at %i×%i the planner is %s (sidebar %s px)", async (width, height, layout, asideWidth) => {
    const geometry = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        const aside = document.querySelector<HTMLElement>('aside[aria-label="requirements"]')!;
        const timeline = document.querySelector<HTMLElement>(".planner-timeline-area")!;
        const a = aside.getBoundingClientRect();
        const t = timeline.getBoundingClientRect();
        return {
          sideBySide: a.right <= t.left && Math.abs(a.top - t.top) <= 1,
          stacked: a.top >= t.bottom,
          asideWidth: aside.offsetWidth,
        };
      }),
    );
    if (layout === "side-by-side") {
      expect(geometry.sideBySide).toBe(true);
      expect(geometry.asideWidth).toBe(asideWidth);
    } else {
      expect(geometry.stacked).toBe(true);
    }
  });

  it.each([
    [1920, 1080, 3],
    [1440, 900, 2],
    [1100, 800, 1],
  ])("at %i×%i a three-course group renders %i card columns", async (width, height, columns) => {
    const tracks = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        const list = document.querySelector('.available-courses[data-columns="3"]');
        return list ? getComputedStyle(list).gridTemplateColumns.split(" ").length : null;
      }),
    );
    expect(tracks).toBe(columns);
  });

  it.each([
    [1920, 1080],
    [1280, 800],
    [1100, 800],
    [900, 800],
    [390, 844],
  ])("at %i×%i the course-search placeholder isn't cut off", async (width, height) => {
    const fit = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        // An input never scrolls its placeholder, so measure the text itself
        // in the input's own font against the input's content box.
        const input = document.querySelector<HTMLInputElement>(".course-search-field input")!;
        const style = getComputedStyle(input);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = style.font;
        const text = context.measureText(input.placeholder).width;
        const box = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return { text: Math.ceil(text), box };
      }),
    );
    expect(fit.text).toBeLessThanOrEqual(fit.box);
  });

  it.each([
    [1920, 1080],
    [1440, 900],
    [1100, 800],
    [390, 844],
  ])("at %i×%i every course card stays inside its group", async (width, height) => {
    const escaped = await withPlan({ width, height }, (page) =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".available-courses > *")]
          .filter((card) => {
            const group = card.parentElement!.closest("li");
            return !group || card.getBoundingClientRect().right > group.getBoundingClientRect().right - 1;
          })
          .map((card) => card.textContent?.trim().slice(0, 12)),
      ),
    );
    expect(escaped).toEqual([]);
  });
});

describe("site nav", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const navHidden = { storage: { "panel-nav": "hidden" } };
  const helpUrl = () => new URL("/help/", baseUrl).href;

  it("hides behind a tab, moves focus between the controls, and remembers the choice", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const nav = page.locator('nav[aria-label="site"]');
      const show = page.locator("button.nav-show");
      const hide = page.locator("button.nav-hide");
      const focused = (selector: string) =>
        page.evaluate((s) => document.activeElement === document.querySelector(s), selector);

      expect(await nav.isVisible()).toBe(true);
      expect(await show.isVisible()).toBe(false);

      await hide.click();
      expect(await nav.isVisible()).toBe(false);
      expect(await show.isVisible()).toBe(true);
      expect(await focused("button.nav-show")).toBe(true);
      expect(await horizontalOverflow(page)).toBe(0);
      const clear = await page.evaluate(() => {
        const h1 = document.querySelector("h1")!.getBoundingClientRect();
        const tab = document.querySelector("button.nav-show")!.getBoundingClientRect();
        return h1.left >= tab.right;
      });
      expect(clear).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("panel-nav"))).toBe("hidden");

      await page.reload({ waitUntil: "networkidle" });
      expect(await nav.isVisible()).toBe(false);

      await show.click();
      expect(await nav.isVisible()).toBe(true);
      expect(await focused("button.nav-hide")).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("panel-nav"))).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("applies the saved state before any bundled script runs", async () => {
    const page = await openPage(browser, helpUrl(), desktop, { ...navHidden, blockScripts: true });
    try {
      expect(await page.locator('nav[aria-label="site"]').isVisible()).toBe(false);
      expect(await page.locator("button.nav-show").isVisible()).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("passes axe with the nav hidden", async () => {
    const page = await openPage(browser, planUrl(), desktop, navHidden);
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("gives the planner room for a wider sidebar tier when hidden", async () => {
    const page = await openPage(browser, planUrl(), { width: 1440, height: 900 }, navHidden);
    try {
      const width = await page.evaluate(
        () => document.querySelector<HTMLElement>('aside[aria-label="requirements"]')!.offsetWidth,
      );
      expect(width).toBe(715);
    } finally {
      await page.close();
    }
  });
});

describe("site nav in the top bar", { timeout: 30_000 }, () => {
  const phone = { width: 390, height: 844 };
  const navHidden = { storage: { "panel-nav": "hidden" } };
  // Degrees the element is turned clockwise: 90 for a chevron rotated onto
  // the bar's axis, 0 when untransformed.
  const rotation = (page: Page, selector: string) =>
    page.evaluate((s) => {
      const transform = getComputedStyle(document.querySelector(s)!).transform;
      const m = new DOMMatrix(transform === "none" ? "" : transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    }, selector);
  const focused = (page: Page, selector: string) =>
    page.evaluate((s) => document.activeElement === document.querySelector(s), selector);

  it("hides from the brand row, moves focus between the controls, and remembers the choice", async () => {
    const page = await openPage(browser, planUrl(), phone);
    try {
      const nav = page.locator('nav[aria-label="site"]');
      const show = page.locator("button.nav-show");
      const hide = page.locator("button.nav-hide");

      expect(await hide.isVisible()).toBe(true);
      expect((await hide.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const row = await page.evaluate(() => {
        const button = document.querySelector("button.nav-hide")!.getBoundingClientRect();
        const brand = document.querySelector(".brand")!.getBoundingClientRect();
        const link = document.querySelector(".nav-links a")!.getBoundingClientRect();
        return {
          centreGap: Math.abs(button.top + button.height / 2 - (brand.top + brand.height / 2)),
          aboveLinks: button.top < link.top,
        };
      });
      expect(row.centreGap).toBeLessThanOrEqual(4);
      expect(row.aboveLinks).toBe(true);
      expect(await rotation(page, "button.nav-hide .nav-toggle-icon")).toBe(90);

      await hide.click();
      expect(await nav.isVisible()).toBe(false);
      expect(await show.isVisible()).toBe(true);
      expect(await focused(page, "button.nav-show")).toBe(true);
      expect(await rotation(page, "button.nav-show .nav-toggle-icon")).toBe(90);
      expect(await page.evaluate(() => localStorage.getItem("panel-nav"))).toBe("hidden");
      expect(await horizontalOverflow(page)).toBe(0);

      await show.click();
      expect(await nav.isVisible()).toBe(true);
      expect(await focused(page, "button.nav-hide")).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("panel-nav"))).toBeNull();
    } finally {
      await page.close();
    }
  });

  it.each(ROUTES.flatMap((route) => [[route, 390, 844] as const, [route, 900, 800] as const]))(
    "on %s at %i×%i the tab shares the title's row and covers nothing",
    async (route, width, height) => {
      const page = await openPage(browser, new URL(route, baseUrl).href, { width, height }, navHidden);
      try {
        expect(await page.locator("button.nav-show").isVisible()).toBe(true);
        const layout = await page.evaluate(() => {
          const tab = document.querySelector("button.nav-show")!;
          const h1 = document.querySelector("h1")!;
          const t = tab.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(h1);
          const text = range.getBoundingClientRect();
          const covered = [...document.querySelectorAll("main *")]
            .filter((el) => !tab.contains(el) && !h1.contains(el) && !el.contains(h1))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 && r.height > 0 && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top
              );
            })
            .map((el) => `${el.tagName}.${el.className}`);
          return {
            clearOfText: text.left >= t.right,
            sameRow: t.top < text.bottom && t.bottom > text.top,
            covered,
          };
        });
        expect(layout.clearOfText).toBe(true);
        expect(layout.sameRow).toBe(true);
        expect(layout.covered).toEqual([]);
        expect(await horizontalOverflow(page)).toBe(0);
      } finally {
        await page.close();
      }
    },
  );

  it("applies the saved state before any bundled script runs", async () => {
    const page = await openPage(browser, new URL("/help/", baseUrl).href, phone, {
      ...navHidden,
      blockScripts: true,
    });
    try {
      expect(await page.locator('nav[aria-label="site"]').isVisible()).toBe(false);
      expect(await page.locator("button.nav-show").isVisible()).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("passes axe with the nav hidden", async () => {
    const page = await openPage(browser, planUrl(), phone, navHidden);
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("leaves the desktop rail's controls as they were", async () => {
    const desktop = { width: 1920, height: 1080 };
    const shown = await openPage(browser, planUrl(), desktop);
    try {
      expect(await rotation(shown, "button.nav-hide .nav-toggle-icon")).toBe(0);
    } finally {
      await shown.close();
    }
    const hidden = await openPage(browser, planUrl(), desktop, navHidden);
    try {
      const styles = await hidden.evaluate(() => ({
        position: getComputedStyle(document.querySelector("button.nav-show")!).position,
        indent: getComputedStyle(document.querySelector("h1")!).paddingInlineStart,
      }));
      expect(styles).toEqual({ position: "fixed", indent: "0px" });
    } finally {
      await hidden.close();
    }
  });
});

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

  // The pane is the timeline's only vertical scroller, and it ends at the
  // bottom of the tallest semester column — the prereq overlay mustn't pad
  // it out (it used to size itself from a scrollHeight it was part of).
  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the timeline scrolls vertically once, to the bottom of the columns", async (width, height) => {
    const result = await withPlan({ width, height }, (page) =>
      page.evaluate(() => {
        const scroll = document.querySelector<HTMLElement>(".timeline-scroll")!;
        const svg = document.querySelector(".prereq-overlay")!;
        const top = scroll.getBoundingClientRect().top;
        const columnsBottom = Math.max(
          ...[...scroll.querySelectorAll(".term")].map((t) => t.getBoundingClientRect().bottom - top),
        );
        return {
          innerOverflowY: getComputedStyle(scroll).overflowY,
          innerExtra: scroll.scrollHeight - scroll.clientHeight,
          svgExtra: svg.getBoundingClientRect().height - columnsBottom - parseFloat(getComputedStyle(scroll).paddingBottom),
        };
      }),
    );
    expect(result.innerOverflowY).toBe("hidden");
    expect(result.innerExtra).toBeLessThanOrEqual(0);
    expect(result.svgExtra).toBeLessThanOrEqual(1);
  });

  it("scrolls each pane on its own while the title stays put", async () => {
    const result = await withPlan({ width: 1920, height: 1080 }, (page) =>
      page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const aside = document.querySelector<HTMLElement>("aside")!;
        const timeline = document.querySelector<HTMLElement>(".planner-timeline-area")!;
        const titleTop = rect("h1").top;
        aside.scrollTop = 300;
        const afterAside = {
          aside: aside.scrollTop,
          timeline: timeline.scrollTop,
          page: document.scrollingElement!.scrollTop,
          titleMoved: rect("h1").top !== titleTop,
        };
        timeline.scrollTop = 300;
        return { afterAside, afterTimeline: { aside: aside.scrollTop, timeline: timeline.scrollTop } };
      }),
    );
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

describe("requirements sidebar collapse", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const reqsCollapsed = { storage: { "panel-reqs": "collapsed" } };
  const asideWidth = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>('aside[aria-label="requirements"]')!.offsetWidth);
  const timelineWidth = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>(".planner-timeline-area")!.offsetWidth);
  const focused = (page: Page, selector: string) =>
    page.evaluate((s) => document.activeElement === document.querySelector(s), selector);

  it("collapses to a rail, moves focus between the controls, and remembers the choice", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const rail = page.locator(".reqs-rail");
      const content = page.locator(".requirements-scroll");
      const timelineBefore = await timelineWidth(page);

      await page.locator("button.reqs-hide").click();
      expect(await rail.isVisible()).toBe(true);
      expect(await focused(page, ".reqs-rail")).toBe(true);
      expect(await content.isVisible()).toBe(false);
      expect(await asideWidth(page)).toBe(48);
      expect((await timelineWidth(page)) - timelineBefore).toBeGreaterThanOrEqual(600);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await page.evaluate(() => localStorage.getItem("panel-reqs"))).toBe("collapsed");

      await page.reload({ waitUntil: "networkidle" });
      expect(await rail.isVisible()).toBe(true);
      expect(await asideWidth(page)).toBe(48);

      await rail.click();
      expect(await asideWidth(page)).toBe(715);
      expect(await focused(page, ".reqs-hide")).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("panel-reqs"))).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("applies the saved state before any bundled script runs", async () => {
    const page = await openPage(browser, planUrl(), desktop, { ...reqsCollapsed, blockScripts: true });
    try {
      expect(await asideWidth(page)).toBe(48);
      expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
    } finally {
      await page.close();
    }
  });

  it.each([
    [390, 844],
    [800, 800],
  ])("applies the saved collapsed state in the stacked layout at %i×%i", async (width, height) => {
    const page = await openPage(browser, planUrl(), { width, height }, reqsCollapsed);
    try {
      expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(false);
      expect(await page.locator(".reqs-hide").isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  });

  it("collapses from the 1-column layout on a tablet", async () => {
    const page = await openPage(browser, planUrl(), { width: 900, height: 800 });
    try {
      await page.locator("button.reqs-hide").click();
      expect(await asideWidth(page)).toBe(48);
    } finally {
      await page.close();
    }
  });

  it("names the rail with the program's progress", async () => {
    const page = await openPage(browser, planUrl(), desktop, reqsCollapsed);
    try {
      const rail = page.getByRole("button", { name: /^Show requirements: \d+ completed, \d+ planned of 192$/ });
      expect(await rail.count()).toBe(1);
    } finally {
      await page.close();
    }
  });

  it("passes axe with the sidebar collapsed", async () => {
    const page = await openPage(browser, planUrl(), desktop, reqsCollapsed);
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});

describe("requirements rail as a drop target", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  it("dragging a placed course onto the collapsed rail removes it", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop, {
      storage: { "panel-reqs": "collapsed" },
    });
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      const box = (await page.locator(".reqs-rail").boundingBox())!;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      expect(await page.locator("aside.reqs-drop-ready").count()).toBe(1);
      await page.mouse.up();
      await expect.poll(() => card.count()).toBe(0);
      expect(await page.locator("aside.reqs-drop-ready").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("doesn't signal a drop target while dragging a course that isn't placed", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const card = page.locator(".course-card-unplaced").first();
      const box = (await page.locator(".planner-timeline-area").boundingBox())!;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      expect(await page.locator(".reqs-drop-ready").count()).toBe(0);
      await page.mouse.up();
    } finally {
      await page.close();
    }
  });

  it.each([
    ["expanded", {}, 'aside[aria-label="requirements"]'],
    ["collapsed", { "panel-reqs": "collapsed" }, ".reqs-rail"],
  ])("dropping a placed course on the %s sidebar offers to undo the removal", async (_state, storage, target) => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop, { storage });
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      const box = (await page.locator(target).boundingBox())!;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect.poll(() => card.count()).toBe(0);

      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      expect(await toast.textContent()).toContain("Removed COMP1130");
      await toast.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => card.count()).toBe(1);
    } finally {
      await page.close();
    }
  });
});

describe("term drop-target outline", { timeout: 30_000 }, () => {
  // COMP3630 is hard-blocked from term 0 (see planner-logic.test.ts) but
  // allowed in a later one, so one drag passes over both kinds of column.
  const outlined = (page: Page, term: number) =>
    page
      .locator(`[data-term="${term}"]`)
      .evaluate((el) => getComputedStyle(el).outlineStyle !== "none" && getComputedStyle(el).outlineWidth !== "0px");
  // Playwright delivers each dragover a move behind the pointer (a real
  // browser keeps firing it while the pointer rests), so settle with a
  // second small move inside the target.
  async function hoverInside(page: Page, box: { x: number; y: number; width: number; height: number }) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4, { steps: 2 });
  }
  // Only meaningful mid-drag, once the timeline has greyed the blocked terms.
  const openTerm = async (page: Page) =>
    Number(await page.locator("[data-term]:not(.term-disallowed)").first().getAttribute("data-term"));

  it("outlines the term under a mouse drag, but not a hard-blocked one", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      const card = page.locator('[data-drag-code="COMP3630"]').first();
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.mouse.down();
      const start = (await card.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 }); // starts the drag, so terms grey out
      const term = await openTerm(page);
      const open = (await page.locator(`[data-term="${term}"]`).boundingBox())!;
      await hoverInside(page, open);
      await expect.poll(() => outlined(page, term)).toBe(true);

      const blocked = (await page.locator('[data-term="0"]').boundingBox())!;
      await hoverInside(page, blocked);
      expect(await page.locator('[data-term="0"].term-disallowed').count()).toBe(1);
      expect(await outlined(page, 0)).toBe(false);
      expect(await outlined(page, term)).toBe(false);
      await page.mouse.up();
    } finally {
      await page.close();
    }
  });

  it("outlines the term under a touch drag, but not a hard-blocked one", async () => {
    const id = await planWithPlacement("COMP1130");
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await page.goto(new URL(`/plan/${id}`, baseUrl).href, { waitUntil: "networkidle" });
      const cdp = await context.newCDPSession(page);
      const touch = (type: string, x = 0, y = 0) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        } as never);
      const centre = async (selector: string) => {
        const box = (await page.locator(selector).first().boundingBox())!;
        return [box.x + box.width / 2, box.y + Math.min(box.height / 2, 40)] as const;
      };

      const card = page.locator('[data-drag-code="COMP3630"]').first();
      await card.scrollIntoViewIfNeeded();
      const [cx, cy] = await centre('[data-drag-code="COMP3630"]');
      await touch("touchStart", cx, cy);
      await page.waitForTimeout(450); // past touch-drag.ts's HOLD_MS
      await expect.poll(() => page.locator(".drag-ghost").count()).toBe(1);

      const [bx, by] = await centre('[data-term="0"]');
      await touch("touchMove", bx, by);
      await touch("touchMove", bx + 4, by + 4);
      // The hover class does land on the blocked term — only the outline is withheld.
      await expect.poll(() => page.locator('[data-term="0"].drag-hover-target').count()).toBe(1);
      expect(await page.locator('[data-term="0"].term-disallowed').count()).toBe(1);
      expect(await outlined(page, 0)).toBe(false);

      const term = await openTerm(page);
      // Narrow timeline: bring the allowed column on-screen mid-drag.
      await page.locator(`[data-term="${term}"]`).evaluate((el) => el.scrollIntoView({ inline: "center" }));
      const [ox, oy] = await centre(`[data-term="${term}"]`);
      await touch("touchMove", ox, oy);
      await touch("touchMove", ox + 4, oy + 4); // pointermove is frame-aligned; settle as hoverInside does
      await expect.poll(() => outlined(page, term)).toBe(true);
      await touch("touchEnd");
    } finally {
      await context.close();
    }
  });
});

describe("stacked requirements collapse", { timeout: 30_000 }, () => {
  const phone = { width: 390, height: 844 };
  const reqsCollapsed = { storage: { "panel-reqs": "collapsed" } };
  const focused = (page: Page, selector: string) =>
    page.evaluate((s) => document.activeElement === document.querySelector(s), selector);
  const panelReqs = (page: Page) => page.evaluate(() => localStorage.getItem("panel-reqs"));

  it("collapses to a bar along the bottom of the planner and expands again", async () => {
    const page = await openPage(browser, planUrl(), phone);
    try {
      const hide = page.locator("button.reqs-hide");
      const rail = page.locator(".reqs-rail");
      const content = page.locator(".requirements-scroll");
      expect(await hide.isVisible()).toBe(true);
      expect((await hide.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await hide.click();
      expect(await rail.isVisible()).toBe(true);
      expect(await focused(page, ".reqs-rail")).toBe(true);
      expect(await content.isVisible()).toBe(false);
      expect(await panelReqs(page)).toBe("collapsed");
      const bar = (await rail.boundingBox())!;
      expect(bar.height).toBeGreaterThanOrEqual(44);
      expect(bar.width).toBeGreaterThan(bar.height);
      const geometry = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const a = rect("aside");
        const p = rect(".planner-panes");
        const t = rect(".planner-timeline-area");
        return {
          asideGap: Math.abs(a.bottom - p.bottom),
          timelineFills: t.height >= p.height - a.height - 17,
        };
      });
      expect(geometry.asideGap).toBeLessThanOrEqual(1);
      expect(geometry.timelineFills).toBe(true);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await verticalOverflow(page)).toBe(0);
      const named = page.getByRole("button", { name: /^Show requirements: \d+ completed, \d+ planned of 192$/ });
      expect(await named.evaluate((el) => el.classList.contains("reqs-rail"))).toBe(true);

      await rail.click();
      expect(await content.isVisible()).toBe(true);
      expect(await focused(page, ".reqs-hide")).toBe(true);
      expect(await panelReqs(page)).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("shows the bar before any bundled script runs", async () => {
    const page = await openPage(browser, planUrl(), phone, { ...reqsCollapsed, blockScripts: true });
    try {
      expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080, "height"],
    [390, 844, "width"],
  ] as const)("at %i×%i the fill's %s follows the program's progress", async (width, height, side) => {
    const page = await openPage(browser, planUrl(), { width, height }, reqsCollapsed);
    try {
      const ratio = await page.evaluate((s) => {
        const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
        return rect(".reqs-rail-completed")[s] / rect(".reqs-rail-bar")[s];
      }, side);
      expect(Math.abs(ratio - 0.25)).toBeLessThanOrEqual(0.02);
    } finally {
      await page.close();
    }
  });

  it("is a drop target for removing a placed course", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, phone, reqsCollapsed);
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      const rail = page.locator(".reqs-rail");
      const box = (await rail.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(x, y, { steps: 10 });
      expect(await page.locator("aside.reqs-drop-ready").count()).toBe(1);
      expect(await rail.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("dashed");
      expect(
        await page.evaluate(
          ([px, py]) => !!document.elementFromPoint(px, py)?.closest("aside[aria-label='requirements']"),
          [x, y],
        ),
      ).toBe(true);
      await page.mouse.up();
      await expect.poll(() => card.count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("collapses below the fitted height too", async () => {
    const page = await openPage(browser, planUrl(), { width: 700, height: 400 });
    try {
      const hide = page.locator("button.reqs-hide");
      expect(await hide.isVisible()).toBe(true);
      await hide.click();
      expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
      expect(await panelReqs(page)).toBe("collapsed");
    } finally {
      await page.close();
    }
  });

  it("passes axe with the requirements collapsed", async () => {
    const page = await openPage(browser, planUrl(), phone, reqsCollapsed);
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});

describe("undo toast placement", { timeout: 30_000 }, () => {
  // Drops COMP1130 on `target` in a fresh plan and waits for the undo toast.
  async function dropAndToast(viewport: Viewport, storage: Record<string, string>, target: string) {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport, { storage });
    const box = (await page.locator(target).boundingBox())!;
    await page.locator('[data-placed="COMP1130"]').hover();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    const toast = page.locator(".undo-toast");
    await expect.poll(() => toast.count()).toBe(1);
    return { page, toast };
  }

  it("sits above the collapsed stacked bar", async () => {
    const { page, toast } = await dropAndToast({ width: 390, height: 844 }, { "panel-reqs": "collapsed" }, ".reqs-rail");
    try {
      const toastBox = (await toast.boundingBox())!;
      const railBox = (await page.locator(".reqs-rail").boundingBox())!;
      expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(railBox.y);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080, { "panel-reqs": "collapsed" }, ".reqs-rail"],
    [390, 844, {}, 'aside[aria-label="requirements"]'],
  ])("stays in place at %i×%i with %o", async (width, height, storage, target) => {
    const { page, toast } = await dropAndToast({ width, height }, storage, target);
    try {
      expect(await toast.evaluate((el) => getComputedStyle(el).bottom)).toBe("24px");
    } finally {
      await page.close();
    }
  });
});

describe("requirements resize handle", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  const separator = (page: Page) => page.getByRole("separator", { name: "Resize requirements" });
  const asideWidth = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>("#requirements")!.offsetWidth);
  const asideLeft = (page: Page) =>
    page.evaluate(() => document.querySelector("#requirements")!.getBoundingClientRect().left);
  const tracks = (page: Page) =>
    page.evaluate(() => {
      const list = document.querySelector('.available-courses[data-columns="3"]');
      return list ? getComputedStyle(list).gridTemplateColumns.split(" ").length : null;
    });
  const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

  // Presses on the handle's centre and releases at `x`, leaving the move's
  // intermediate state for the caller when `release` is false.
  async function dragHandleTo(page: Page, x: number, release = true) {
    const box = (await separator(page).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 5 });
    if (release) await page.mouse.up();
  }

  it("starts at 3 columns, controls the sidebar, and spans its height", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const sep = separator(page);
      expect(await sep.getAttribute("aria-valuenow")).toBe("3");
      expect(await sep.getAttribute("aria-valuemax")).toBe("3");
      expect(await sep.getAttribute("aria-valuetext")).toBe("3 columns");
      expect(await sep.getAttribute("aria-controls")).toBe("requirements");
      const handle = (await sep.boundingBox())!;
      const aside = (await page.locator("#requirements").boundingBox())!;
      expect(Math.abs(handle.y - aside.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(handle.height - aside.height)).toBeLessThanOrEqual(1);
    } finally {
      await page.close();
    }
  });

  it("steps through the sizes from the keyboard and saves each one", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const sep = separator(page);
      await sep.focus();
      const steps: [string, string, number | null][] = [
        ["ArrowLeft", "2 columns", 498],
        ["ArrowLeft", "1 column", 280],
        ["ArrowLeft", "Collapsed", 48],
        ["ArrowRight", "1 column", null],
        ["End", "3 columns", 715],
        ["Home", "Collapsed", null],
      ];
      for (const [key, text, width] of steps) {
        await page.keyboard.press(key);
        await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe(text);
        if (width !== null) expect(await asideWidth(page)).toBe(width);
        if (text === "2 columns") {
          expect(await tracks(page)).toBe(2);
          expect(await stored(page, "panel-reqs-cols")).toBe("2");
        }
        if (text === "1 column" && width !== null) expect(await tracks(page)).toBe(1);
        if (text === "Collapsed" && width !== null) expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
        expect(await horizontalOverflow(page)).toBe(0);
        expect(await verticalOverflow(page)).toBe(0);
      }
    } finally {
      await page.close();
    }
  });

  it("applies the saved column count before any bundled script runs", async () => {
    const page = await openPage(browser, planUrl(), desktop, {
      storage: { "panel-reqs-cols": "2" },
      blockScripts: true,
    });
    try {
      expect(await asideWidth(page)).toBe(498);
      expect(await tracks(page)).toBe(2);
    } finally {
      await page.close();
    }
  });

  it("can't reach more columns than fit", async () => {
    const page = await openPage(browser, planUrl(), { width: 1280, height: 800 });
    try {
      const sep = separator(page);
      await expect.poll(() => sep.getAttribute("aria-valuemax")).toBe("2");
      await sep.focus();
      await page.keyboard.press("End");
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("2 columns");
    } finally {
      await page.close();
    }

    const seeded = await openPage(browser, planUrl(), { width: 1280, height: 800 }, {
      storage: { "panel-reqs-cols": "3" },
    });
    try {
      expect(await asideWidth(seeded)).toBe(498);
    } finally {
      await seeded.close();
    }

    const narrow = await openPage(browser, planUrl(), { width: 1100, height: 800 });
    try {
      await expect.poll(() => separator(narrow).getAttribute("aria-valuemax")).toBe("1");
    } finally {
      await narrow.close();
    }
  });

  it("previews while dragging and saves only on release", async () => {
    const page = await openPage(browser, planUrl(), desktop);
    try {
      const sep = separator(page);
      const left = await asideLeft(page);

      await dragHandleTo(page, left + 20 * 16, false);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("1 column");
      expect(await asideWidth(page)).toBe(280);
      expect(await stored(page, "panel-reqs-cols")).toBeNull();
      await page.mouse.up();
      await expect.poll(() => stored(page, "panel-reqs-cols")).toBe("1");

      await dragHandleTo(page, left + 5 * 16);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("Collapsed");
      await expect.poll(() => stored(page, "panel-reqs")).toBe("collapsed");

      // The handle stays beside the rail, so dragging out from there expands.
      await dragHandleTo(page, left + 40 * 16);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("3 columns");
      await expect.poll(() => stored(page, "panel-reqs")).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("expands from the rail to the saved column count", async () => {
    const page = await openPage(browser, planUrl(), desktop, {
      storage: { "panel-reqs": "collapsed", "panel-reqs-cols": "2" },
    });
    try {
      await page.locator(".reqs-rail").click();
      await expect.poll(() => asideWidth(page)).toBe(498);
    } finally {
      await page.close();
    }
  });

  // The timeline's share of the planner's height, in %.
  const share = (page: Page) =>
    page.evaluate(() => {
      const height = (s: string) => document.querySelector(s)!.getBoundingClientRect().height;
      return (height(".planner-timeline-area") / height(".planner-panes")) * 100;
    });

  it("turns horizontal between the timeline and the requirements on a phone", async () => {
    const page = await openPage(browser, planUrl(), phone);
    try {
      const sep = separator(page);
      await expect.poll(() => sep.getAttribute("aria-orientation")).toBe("horizontal");
      expect(await sep.getAttribute("aria-valuemin")).toBe("30");
      expect(await sep.getAttribute("aria-valuemax")).toBe("100");
      expect(await sep.getAttribute("aria-valuenow")).toBe("50");
      expect(await sep.getAttribute("aria-valuetext")).toBe("Timeline 50%");
      expect(await sep.getAttribute("aria-controls")).toBe("requirements");
      const box = (await sep.boundingBox())!;
      const timeline = (await page.locator(".planner-timeline-area").boundingBox())!;
      const aside = (await page.locator("#requirements").boundingBox())!;
      expect(Math.abs(box.y - (timeline.y + timeline.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height - aside.y)).toBeLessThanOrEqual(1);
      expect(box.height).toBe(16);
      // Probed near the left edge: the right-aligned sticky "Hide
      // requirements" button (z-index 1) deliberately wins where it overlaps
      // the lower hit area.
      const hits = await page.evaluate(
        ([x, above, below]) => {
          const handle = document.querySelector(".reqs-resize");
          return [document.elementFromPoint(x, above) === handle, document.elementFromPoint(x, below) === handle];
        },
        [box.x + 20, box.y - 12, box.y + box.height + 12],
      );
      expect(hits).toEqual([true, true]);
    } finally {
      await page.close();
    }
  });

  it("is hidden in the stacked layout below 30rem tall", async () => {
    const page = await openPage(browser, planUrl(), { width: 700, height: 400 });
    try {
      expect(await separator(page).isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  });

  it("steps the stacked split from the keyboard and saves each one", async () => {
    const page = await openPage(browser, planUrl(), phone);
    try {
      const sep = separator(page);
      await expect.poll(() => sep.getAttribute("aria-orientation")).toBe("horizontal");
      await sep.focus();
      const none = async () => {};
      const steps: [string, string, number | null, () => Promise<void>][] = [
        ["ArrowDown", "Timeline 70%", 70, async () => expect(await stored(page, "panel-split")).toBe("70")],
        [
          "ArrowDown",
          "Requirements hidden",
          null,
          async () => {
            expect(await page.locator(".reqs-rail").isVisible()).toBe(true);
            expect(await stored(page, "panel-reqs")).toBe("collapsed");
          },
        ],
        ["ArrowDown", "Requirements hidden", null, none],
        ["ArrowUp", "Timeline 70%", 70, async () => expect(await stored(page, "panel-reqs")).toBeNull()],
        ["Home", "Timeline 30%", 30, async () => expect(await stored(page, "panel-split")).toBe("30")],
        ["End", "Requirements hidden", null, none],
        ["ArrowUp", "Timeline 70%", 70, none],
        ["ArrowUp", "Timeline 50%", 50, async () => expect(await stored(page, "panel-split")).toBeNull()],
      ];
      for (const [key, text, pct, also] of steps) {
        await page.keyboard.press(key);
        await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe(text);
        if (pct !== null) expect(Math.abs((await share(page)) - pct)).toBeLessThanOrEqual(1.5);
        await also();
        expect(await horizontalOverflow(page)).toBe(0);
        expect(await verticalOverflow(page)).toBe(0);
      }
    } finally {
      await page.close();
    }
  });

  it("previews the stacked split while dragging and saves only on release", async () => {
    const page = await openPage(browser, planUrl(), phone);
    try {
      const sep = separator(page);
      await expect.poll(() => sep.getAttribute("aria-orientation")).toBe("horizontal");
      const p = (await page.locator(".planner-panes").boundingBox())!;
      // Presses on the handle's centre and moves to `fraction` of the panes'
      // height, leaving the release to the caller when `release` is false.
      async function dragTo(fraction: number, release = true) {
        const box = (await sep.boundingBox())!;
        const x = box.x + box.width / 2;
        await page.mouse.move(x, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(x, p.y + fraction * p.height, { steps: 5 });
        if (release) await page.mouse.up();
      }

      await dragTo(0.3, false);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("Timeline 30%");
      expect(Math.abs((await share(page)) - 30)).toBeLessThanOrEqual(1.5);
      expect(await stored(page, "panel-split")).toBeNull();
      await page.mouse.up();
      await expect.poll(() => stored(page, "panel-split")).toBe("30");

      await dragTo(0.92);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("Requirements hidden");
      await expect.poll(() => stored(page, "panel-reqs")).toBe("collapsed");

      // The handle stays just above the bar, so dragging up from there expands.
      await dragTo(0.5);
      await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe("Timeline 50%");
      await expect.poll(() => stored(page, "panel-reqs")).toBeNull();
      expect(await stored(page, "panel-split")).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("applies the saved split before any bundled script runs", async () => {
    const page = await openPage(browser, planUrl(), phone, { storage: { "panel-split": "70" }, blockScripts: true });
    try {
      expect(Math.abs((await share(page)) - 70)).toBeLessThanOrEqual(1.5);
    } finally {
      await page.close();
    }
  });

  it("expands from the bar to the saved split", async () => {
    const page = await openPage(browser, planUrl(), phone, {
      storage: { "panel-reqs": "collapsed", "panel-split": "30" },
    });
    try {
      await page.locator(".reqs-rail").click();
      await expect.poll(async () => Math.abs((await share(page)) - 30)).toBeLessThanOrEqual(1.5);
      expect(await page.evaluate(() => document.activeElement === document.querySelector(".reqs-hide"))).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("leaves the side-by-side sidebar alone with a saved split", async () => {
    const page = await openPage(browser, planUrl(), desktop, { storage: { "panel-split": "30" } });
    try {
      expect(await asideWidth(page)).toBe(715);
      expect(await separator(page).getAttribute("aria-orientation")).toBe("vertical");
    } finally {
      await page.close();
    }
  });

  it.each<Record<string, string>>([{ "panel-split": "30" }, {}, { "panel-split": "70" }, { "panel-reqs": "collapsed" }])(
    "passes axe on a phone with %o",
    async (storage) => {
      const page = await openPage(browser, planUrl(), phone, { storage });
      try {
        await expect.poll(() => separator(page).getAttribute("aria-orientation")).toBe("horizontal");
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  it.each([
    ["at 1 column", { "panel-reqs-cols": "1" }],
    ["collapsed", { "panel-reqs": "collapsed" }],
  ])("passes axe %s", async (_state, storage) => {
    const page = await openPage(browser, planUrl(), desktop, { storage });
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});

describe("completed-semesters row", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const fewer = { name: "One fewer semester completed" };
  const more = { name: "One more semester completed" };

  function verticalCentre(box: { y: number; height: number } | null): number {
    return box!.y + box!.height / 2;
  }

  it("shows the short readout, the chevrons and More options on one row", async () => {
    await withPlan(desktop, async (page) => {
      const readout = page.locator(".completed-readout");
      await expect.poll(() => readout.textContent()).toBe("Completed through S2 2027");
      const centre = verticalCentre(await readout.boundingBox());
      for (const name of [fewer, more]) {
        const chevron = page.getByRole("button", name);
        expect(await chevron.isDisabled()).toBe(true);
        const box = await chevron.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(verticalCentre(box) - centre)).toBeLessThanOrEqual(4);
      }
      const moreOptions = await page.getByRole("button", { name: "More options" }).boundingBox();
      expect(moreOptions!.width).toBeGreaterThanOrEqual(44);
      expect(moreOptions!.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(verticalCentre(moreOptions) - centre)).toBeLessThanOrEqual(4);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await verticalOverflow(page)).toBe(0);
    });
  });

  it("puts More options on the readout's row on an editable plan", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const centre = verticalCentre(await page.locator(".completed-readout").boundingBox());
      const moreOptions = await page.getByRole("button", { name: "More options" }).boundingBox();
      expect(Math.abs(verticalCentre(moreOptions) - centre)).toBeLessThanOrEqual(4);
    } finally {
      await page.close();
    }
  });

  it("the › chevron completes one more semester and enables ‹", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const planner = page.locator(".planner");
      const readout = page.locator(".completed-readout");
      const before = Number(await planner.getAttribute("data-cutoff"));
      const beforeText = await readout.textContent();
      await page.getByRole("button", more).click();
      await expect.poll(async () => Number(await planner.getAttribute("data-cutoff"))).toBe(before + 1);
      await expect.poll(() => readout.textContent()).not.toBe(beforeText);
      expect(await page.getByRole("button", fewer).isEnabled()).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("no user-facing text says cutoff", async () => {
    const id = await planWithPlacement("COMP1130");
    for (const path of ["/plan/example", `/plan/${id}`, "/help/", "/readme/"]) {
      const page = await openPage(browser, new URL(path, baseUrl).href, desktop);
      try {
        const text = await page.evaluate(() =>
          [
            document.body.innerText,
            ...[...document.querySelectorAll("[aria-label],[aria-valuetext],[title]")].flatMap((el) => [
              el.getAttribute("aria-label"),
              el.getAttribute("aria-valuetext"),
              el.getAttribute("title"),
            ]),
          ].join(" "),
        );
        expect(text, path).not.toMatch(/cutoff/i);
      } finally {
        await page.close();
      }
    }
  });

  it("Help describes the chevrons by name and the gold line", async () => {
    const page = await openPage(browser, new URL("/help/", baseUrl).href, desktop);
    try {
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toContain("One more semester completed");
      expect(text).toContain("One fewer semester completed");
      expect(text).toContain("gold line");
      expect(text).toContain("More options");
    } finally {
      await page.close();
    }
  });
});

describe("prerequisite links", { timeout: 30_000 }, () => {
  // The example plan places COMP3242 after COMP1140 and three of its
  // "6 units of (COMP3670 or MATH1013 or ... MATH1116)" options, and
  // later courses that build on it — its lines both in and out.
  const lineStates = (page: Page) =>
    page.$$eval(".prereq-overlay line", (lines) =>
      lines.map((line) => ({
        hovered: line.classList.contains("prereq-hovered"),
        option: line.classList.contains("prereq-option"),
        opacity: Number(getComputedStyle(line).opacity),
      })),
    );

  const showLinks = async (page: Page) => {
    await page.getByRole("button", { name: "More options" }).click();
    await page.getByLabel("Show prerequisite links").check();
    await page.keyboard.press("Escape");
  };

  it("the legend appears only with the links on", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      expect(await page.locator(".prereq-legend").count()).toBe(0);
      await showLinks(page);
      expect(await page.locator(".prereq-legend").isVisible()).toBe(true);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the legend's samples are drawn exactly like the lines, and stay in view as the pane scrolls", async (width, height) => {
    await withPlan({ width, height }, async (page) => {
      await showLinks(page);
      const stroke = (selector: string) =>
        page.$eval(selector, (el) => {
          const s = getComputedStyle(el);
          return { color: s.stroke, width: s.strokeWidth, dash: s.strokeDasharray, opacity: s.opacity };
        });
      for (const kind of ["required", "option"]) {
        expect(await stroke(`.prereq-legend line.prereq-${kind}`)).toEqual(
          await stroke(`.prereq-overlay line.prereq-${kind}:not(.prereq-hovered)`),
        );
      }
      expect(await horizontalOverflow(page)).toBe(0);

      const inView = () =>
        page.evaluate(() => {
          const area = document.querySelector(".planner-timeline-area")!;
          area.scrollTop = area.scrollHeight;
          const legend = document.querySelector(".prereq-legend")!.getBoundingClientRect();
          const box = area.getBoundingClientRect();
          return legend.top >= box.top - 1 && legend.bottom <= box.bottom + 1;
        });
      expect(await inView()).toBe(true);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the More options menu opens over the legend, not under it", async (width, height) => {
    await withPlan({ width, height }, async (page) => {
      await showLinks(page);
      await page.getByRole("button", { name: "More options" }).click();
      const hit = await page.evaluate(() => {
        const panel = document.querySelector(".more-options-panel:not([hidden])")!.getBoundingClientRect();
        const legend = document.querySelector(".prereq-legend")!.getBoundingClientRect();
        const top = Math.max(panel.top, legend.top);
        const bottom = Math.min(panel.bottom, legend.bottom);
        const left = Math.max(panel.left, legend.left);
        const right = Math.min(panel.right, legend.right);
        if (bottom <= top || right <= left) return "no overlap";
        const el = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        return el?.closest(".more-options-panel") ? "panel" : "legend";
      });
      expect(["panel", "no overlap"]).toContain(hit);
    });
  });

  it("the hover hint shows with a mouse, not on a touch-only phone", async () => {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      try {
        await page.goto(planUrl(), { waitUntil: "networkidle" });
        await showLinks(page);
        expect(await page.locator(".prereq-legend-hint").isVisible(), `touch: ${touch}`).toBe(!touch);
      } finally {
        await context.close();
      }
    }
  });

  it("hover draws nothing while the links are off", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      await page.locator('[data-placed="COMP3242"]').hover();
      expect(await lineStates(page)).toEqual([]);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i hover bolds a course's own links and dims, not hides, the rest", async (width, height) => {
    await withPlan({ width, height }, async (page) => {
      await page.getByRole("button", { name: "More options" }).click();
      await page.getByLabel("Show prerequisite links").check();
      await page.keyboard.press("Escape");
      const before = await lineStates(page);
      expect(before.some((l) => l.option)).toBe(true);

      await page.locator('[data-placed="COMP3242"]').hover();
      const after = await lineStates(page);
      const hovered = after.filter((l) => l.hovered);
      const rest = after.filter((l) => !l.hovered);
      expect(after).toHaveLength(before.length);
      expect(hovered.length).toBeGreaterThanOrEqual(4);
      expect(hovered.filter((l) => l.option).length).toBeGreaterThanOrEqual(4);
      expect(hovered.every((l) => l.opacity === 1)).toBe(true);
      expect(rest.length).toBeGreaterThan(0);
      expect(rest.every((l) => l.opacity > 0 && l.opacity < Math.min(...hovered.map((h) => h.opacity)))).toBe(true);
    });
  });
});

describe("more options", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const moreOptions = (page: Page) => page.getByRole("button", { name: "More options" });
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
      const moveTo = page.getByRole("button", { name: "Move to…" }).first();
      await more.click();
      await moveTo.click();
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      expect(await moveTo.getAttribute("aria-expanded")).toBe("true");
      await more.click();
      expect(await moveTo.getAttribute("aria-expanded")).toBe("false");
      expect(await more.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // A press on the card itself counts as outside: that's where a drag
  // starts, and an open menu shouldn't ride along under the pointer.
  it("a press outside a course's Move to… menu closes it, even on its own card", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator(".course-card").filter({ hasText: "COMP1130" });
      const moveTo = card.getByRole("button", { name: "Move to…" });
      await moveTo.click();
      expect(await moveTo.getAttribute("aria-expanded")).toBe("true");
      await card.locator(".course-card-allocation").click();
      expect(await moveTo.getAttribute("aria-expanded")).toBe("false");

      await moveTo.click();
      await card.getByRole("menu").click({ position: { x: 2, y: 2 } });
      expect(await moveTo.getAttribute("aria-expanded")).toBe("true");
      await page.locator("h1").click();
      expect(await moveTo.getAttribute("aria-expanded")).toBe("false");
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
        readout: box(document.querySelector(".completed-readout")),
        more: box(document.querySelector(".more-options-toggle")),
        row: box(document.querySelector(".plan-title")),
        actions: box(document.querySelector(".plan-actions")),
        area: box(document.querySelector(".planner-timeline-area"))!,
        term: box(document.querySelector(".term"))!,
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

  it("leaves nothing above the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    for (const viewport of [desktop, phone]) {
      for (const path of ["/plan/example", `/plan/${id}`]) {
        await onPlan(path, viewport, async (page) => {
          const r = await rowRects(page);
          expect(r.term.top - r.area.top, `${path} at ${viewport.width}`).toBeLessThanOrEqual(4);
          expect(await page.locator(".cutoff-controls").count()).toBe(0);
        });
      }
    }
  });

  it("gives the height back to the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    const limits = [
      [desktop, "/plan/example", 64],
      [desktop, `/plan/${id}`, 64],
      [phone, "/plan/example", 125],
      [phone, `/plan/${id}`, 100],
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
  ])("at %i×%i stepping the completed semesters doesn't move the buttons", async (width, height) => {
    const id = await planWithPlacement("COMP1130");
    await onPlan(`/plan/${id}`, { width, height }, async (page) => {
      const buttons = () =>
        page.evaluate(() =>
          [
            'button[aria-label="One fewer semester completed"]',
            'button[aria-label="One more semester completed"]',
            ".more-options-toggle",
          ].map((selector) => {
            const { left, top } = document.querySelector(selector)!.getBoundingClientRect();
            return { left, top };
          }),
        );
      const readout = page.locator(".completed-readout");
      const before = await buttons();
      const beforeText = await readout.textContent();
      await page.getByRole("button", { name: "One more semester completed" }).click();
      await expect.poll(() => readout.textContent()).not.toBe(beforeText);
      const after = await buttons();
      after.forEach((box, i) => {
        expect(Math.abs(box.left - before[i].left)).toBeLessThanOrEqual(1);
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
