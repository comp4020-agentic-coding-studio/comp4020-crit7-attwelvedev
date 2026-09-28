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
  it("the Checks subheading has room above it", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const gap = await page.evaluate(() => {
        const checks = document.querySelector('section[aria-label="program checks"]')!;
        const heading = checks.querySelector("h3")!.getBoundingClientRect();
        // The Total section's own bar text: the nearest one above Checks that isn't a check's.
        let section = checks.parentElement;
        let text: Element | null = null;
        while (section && !text) {
          text = [...section.querySelectorAll(".progress-bar-text")].find((el) => !checks.contains(el)) ?? null;
          section = section.parentElement;
        }
        return { height: heading.height, gap: heading.top - text!.getBoundingClientRect().bottom };
      });
      expect(gap.height).toBeGreaterThan(0);
      expect(gap.gap).toBeGreaterThanOrEqual(12);
    });
  });

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

  // 800px tall, not 1080: shorter cards let the example's timeline fit a
  // 1080px pane, leaving nothing to scroll. The overflow preconditions make
  // the test fail loudly, not pass vacuously, if that happens again.
  it("scrolls each pane on its own while the title stays put", async () => {
    const result = await withPlan({ width: 1920, height: 800 }, (page) =>
      page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const aside = document.querySelector<HTMLElement>("aside")!;
        const timeline = document.querySelector<HTMLElement>(".planner-timeline-area")!;
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

  // COMP2700 is in the local catalogue but outside a new plan's tree, so
  // view.courses has no entry for it — only the search result knows its
  // blocked terms (0, 1, 3, 5, 7: S2-only, with prereqs not doable by S2 2027).
  it("greys a searched course's hard-blocked terms mid-drag, like a requirement-list course", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      await page.fill(".course-search input", "COMP2700");
      await page.click(".course-search button[type=submit]");
      const card = page.locator('.course-search-results [data-drag-code="COMP2700"]');
      await card.waitFor();
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.mouse.down();
      const start = (await card.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 });
      await expect
        .poll(() => page.locator(".term-disallowed").evaluateAll((els) => els.map((el) => el.getAttribute("data-term"))))
        .toEqual(["0", "1", "3", "5", "7"]);
      await page.mouse.up();
    } finally {
      await page.close();
    }
  });

  it("shows an already-placed search result as the requirement lists do: a compact row", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      await page.fill(".course-search input", "COMP1130");
      await page.click(".course-search button[type=submit]");
      const row = page.locator(".course-search .placed-row").filter({ hasText: "COMP1130" });
      await row.waitFor();
      expect(await row.count()).toBe(1);
      expect(await page.locator(".course-search .course-card").filter({ hasText: "COMP1130" }).count()).toBe(0);
      expect(await row.locator(".placed-row-status").innerText()).toBe("Planned S1 2027");
      await row.locator(".course-card-term-link").click();
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-placed"))).toBe("COMP1130");
    } finally {
      await page.close();
    }
  });

  it("lists placed search results as rows after the unplaced cards", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      await page.fill(".course-search input", "COMP11");
      await page.click(".course-search button[type=submit]");
      const row = page.locator(".course-search .placed-row").filter({ hasText: "COMP1130" });
      await row.waitFor();
      const cards = page.locator("ul.available-courses.course-search-results .course-card");
      expect(await cards.count()).toBeGreaterThan(0);
      const lastCard = (await cards.last().boundingBox())!;
      expect((await row.boundingBox())!.y).toBeGreaterThanOrEqual(lastCard.y + lastCard.height);
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

describe("locating a placed course from its term badge", { timeout: 30_000 }, () => {
  it("clears every card's highlight, not just the last one clicked", async () => {
    const id = await planWithPlacement("COMP1100");
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP1110", term: 1 }),
    });
    expect(placed.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    const highlighted = () =>
      page.locator(".course-card-highlighted").evaluateAll((els) => els.map((el) => el.getAttribute("data-placed")));
    try {
      await page.getByRole("button", { name: /^COMP1100 is (completed in|planned for)/ }).first().click();
      await expect.poll(highlighted).toEqual(["COMP1100"]);
      await page.getByRole("button", { name: /^COMP1110 is (completed in|planned for)/ }).first().click();
      // One highlight at a time: the newer locate takes over from the older.
      await expect.poll(highlighted).toEqual(["COMP1110"]);
      await expect.poll(highlighted, { timeout: 4000 }).toEqual([]);
    } finally {
      await page.close();
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
  const phone = { width: 390, height: 844 };
  const toggle = (page: Page) => page.locator("button.completed-toggle");
  const panel = (page: Page) => page.locator(".completed-panel");
  const moreOptions = (page: Page) => page.getByRole("button", { name: "More options", exact: true });

  function verticalCentre(box: { y: number; height: number } | null): number {
    return box!.y + box!.height / 2;
  }

  async function onEditable(viewport: Viewport, check: (page: Page) => Promise<void>) {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("shows the read-only readout and More options on one row", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator(".completed-control button").count()).toBe(0);
      const readout = page.locator(".completed-readout");
      expect(await readout.textContent()).toBe("Completed through S2 2027");
      const box = await moreOptions(page).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(verticalCentre(box) - verticalCentre(await readout.boundingBox()))).toBeLessThanOrEqual(4);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await verticalOverflow(page)).toBe(0);
    });
  });

  it("puts More options on the menu toggle's row on an editable plan", async () => {
    await onEditable(desktop, async (page) => {
      const box = await toggle(page).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const more = await moreOptions(page).boundingBox();
      expect(Math.abs(verticalCentre(more) - verticalCentre(box))).toBeLessThanOrEqual(4);
    });
  });

  it("choosing a later semester completes it", async () => {
    await onEditable(desktop, async (page) => {
      await toggle(page).click();
      await panel(page).getByRole("button", { name: "S1 2028" }).click();
      await expect.poll(async () => Number(await page.locator(".planner").getAttribute("data-cutoff"))).toBe(3);
      expect(await panel(page).isHidden()).toBe(true);
      expect(await toggle(page).evaluate((el) => el === document.activeElement)).toBe(true);
      await expect.poll(() => toggle(page).innerText()).toBe("Completed through S1 2028");
      await toggle(page).click();
      const current = panel(page).locator('button[aria-current="true"]');
      expect(await current.count()).toBe(1);
      expect(await current.innerText()).toContain("S1 2028");
    });
  });

  it("describes the menu toggle with the full completed sentence", async () => {
    await onEditable(desktop, async (page) => {
      const description = await toggle(page).evaluate(
        (el) => document.getElementById(el.getAttribute("aria-describedby") ?? "")?.textContent ?? null,
      );
      expect(description).toBe(
        "Nothing on the timeline counts as completed yet. The gold line on the timeline marks that boundary.",
      );
    });
  });

  it("closes on Escape and shares one open menu with More options", async () => {
    await onEditable(desktop, async (page) => {
      await toggle(page).click();
      expect(await panel(page).isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      expect(await panel(page).isHidden()).toBe(true);
      expect(await toggle(page).evaluate((el) => el === document.activeElement)).toBe(true);

      await toggle(page).click();
      await moreOptions(page).click();
      expect(await panel(page).isHidden()).toBe(true);
      expect(await moreOptions(page).getAttribute("aria-expanded")).toBe("true");
      await toggle(page).click();
      expect(await panel(page).isVisible()).toBe(true);
      expect(await moreOptions(page).getAttribute("aria-expanded")).toBe("false");
    });
  });

  it.each([desktop, phone])("is clean under axe and doesn't overflow when open at $width", async (viewport) => {
    await onEditable(viewport, async (page) => {
      await toggle(page).click();
      expect(await panel(page).isVisible()).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    });
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
    await page.getByRole("button", { name: "More options", exact: true }).click();
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
      await page.getByRole("button", { name: "More options", exact: true }).click();
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
      await page.getByRole("button", { name: "More options", exact: true }).click();
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

describe("manual checks", { timeout: 30_000 }, () => {
  // An editable plan with MATH1115 in S1 2027 and MATH1116 after it — the
  // MATH1116 mark items are then all that's left to verify.
  async function planWithMath1116(): Promise<string> {
    const id = await planWithPlacement("MATH1115");
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "MATH1116", term: 1 }),
    });
    expect(placed.status).toBe(200);
    return id;
  }

  async function openDetails(page: Page, code: string) {
    await page.locator(`[data-placed="${code}"] .course-card-title`).click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor(); // showModal() runs in an effect, after the click
    return dialog;
  }

  const desktop = { width: 1920, height: 1080 };

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i Details offers Met / Not met / Not sure per item, labelled with its course", async (width, height) => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width, height });
    try {
      const dialog = await openDetails(page, "MATH1116");
      const fieldsets = dialog.locator("fieldset");
      expect(await fieldsets.count()).toBe(2);
      expect(await fieldsets.locator("legend").allTextContents()).toEqual([
        "MATH1115 with a mark of 60 or above",
        "MATH1113 with a mark of 80 or above",
      ]);
      for (const fieldset of await fieldsets.all()) {
        for (const name of ["Met", "Not met", "Not sure"]) {
          expect(await fieldset.getByRole("radio", { name, exact: true }).count()).toBe(1);
        }
        expect(await fieldset.getByRole("radio", { name: "Not sure", exact: true }).isChecked()).toBe(true);
      }
      // The course's sidebar entry renders a second (closed) copy of this
      // dialog; a radio name shared with it would merge the two groups.
      const groupSizes = await dialog.locator('input[type="radio"]').evaluateAll((radios) =>
        [...new Set(radios.map((r) => (r as HTMLInputElement).name))].map(
          (name) => document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`).length,
        ),
      );
      expect(groupSizes).toEqual([3, 3]);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the verify badge opens Details at Your checks", async (width, height) => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width, height });
    try {
      const card = page.locator('[data-placed="MATH1116"]');
      const badge = card.locator("button.badge-verify");
      expect(await badge.textContent()).toBe("Verify on P&C: 2 items");
      // innerText, not textContent: the card's own closed dialog lists the
      // items in full, and that's where they belong.
      expect(await card.innerText()).not.toContain("with a mark of 60");
      await badge.click();
      await page.locator("dialog[open]").waitFor(); // showModal() runs in an effect, after the click
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Your checks");
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("answering Met on the MATH1115 mark makes the card Available and drops its verify line", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const dialog = await openDetails(page, "MATH1116");
      await dialog.locator("fieldset").first().getByRole("radio", { name: "Met", exact: true }).check();
      const card = page.locator('[data-placed="MATH1116"]');
      await expect.poll(() => card.locator('[class*="badge-state-"]').textContent()).toBe("Available");
      expect(await card.locator(".badge-verify").count()).toBe(0);

      await page.reload({ waitUntil: "networkidle" });
      const reopened = await openDetails(page, "MATH1116");
      expect(await reopened.locator("fieldset").first().getByRole("radio", { name: "Met", exact: true }).isChecked()).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("Not met turns the card amber with its reason", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const dialog = await openDetails(page, "MATH1116");
      await dialog.locator("fieldset").first().getByRole("radio", { name: "Not met", exact: true }).check();
      const card = page.locator('[data-placed="MATH1116"]');
      await expect.poll(() => card.locator(".badge-state-soft").count()).toBe(1);
      expect(await card.locator(".badge-reason").textContent()).toContain(
        'You marked "MATH1115 with a mark of 60 or above" as not met',
      );
    } finally {
      await page.close();
    }
  });

  it("the read-only example's check controls are disabled", async () => {
    await withPlan(desktop, async (page) => {
      const dialog = await openDetails(page, "COMP4550");
      // Playwright's isDisabled() only knows form controls, not <fieldset>,
      // so read the fieldset's own property — and check what it disables.
      const disabled = await dialog.locator("fieldset").evaluateAll((fs) => fs.map((f) => (f as HTMLFieldSetElement).disabled));
      expect(disabled.length).toBeGreaterThan(0);
      expect(disabled.every(Boolean)).toBe(true);
      for (const radio of await dialog.locator('input[type="radio"]').all()) expect(await radio.isDisabled()).toBe(true);
    });
  });

  it("the requisite tree says an answer was marked by you", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const dialog = await openDetails(page, "MATH1116");
      await dialog.locator("fieldset").first().getByRole("radio", { name: "Met", exact: true }).check();
      await expect.poll(() => dialog.textContent()).toContain("✓ met (marked by you)");
    } finally {
      await page.close();
    }
  });
});

describe("course cards", { timeout: 30_000 }, () => {
  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i no two of a card's buttons touch", async (width, height) => {
    // Measured from the render, not the markup: loose inline buttons pass
    // any markup check yet sit flush against each other on screen.
    const { measured, tight } = await withPlan({ width, height }, (page) =>
      page.$$eval(".course-card", (cards) => {
        let measured = 0;
        const tight: string[] = [];
        for (const card of cards) {
          const rects = Array.from(card.querySelectorAll("button"))
            .filter((b) => !b.closest("dialog") && b.getClientRects().length > 0)
            .map((b) => ({ label: b.textContent?.trim(), rect: b.getBoundingClientRect() }));
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i].rect;
              const b = rects[j].rect;
              const space = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
              measured++;
              if (space < 4) tight.push(`${card.querySelector("strong")?.textContent} ${rects[i].label}/${rects[j].label}: ${space.toFixed(1)}px`);
            }
          }
        }
        return { measured, tight };
      }),
    );
    expect(measured).toBeGreaterThan(0);
    expect(tight).toEqual([]);
  });

  it("a placed course's term button keeps its border on hover", async () => {
    // Guards a cascade slip: a later same-specificity rule gave this button
    // a border its own :hover rule then took away.
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const button = page.locator(".placed-row .course-card-term-link").first();
      const border = () => button.evaluate((el) => getComputedStyle(el).borderTopWidth);
      const atRest = await border();
      await button.hover();
      expect(atRest).not.toBe("0px");
      expect(await border()).toBe(atRest);
    });
  });

  it("a blocked card recedes without fading its controls", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      // The server refuses a hard-blocked placement and a fresh plan has no
      // blocked sidebar card, so give a rendered card the class: this is
      // about the CSS rule, not how the state arises.
      const cards = page.locator(".course-card-unplaced");
      expect(await cards.count()).toBeGreaterThan(1);
      await cards.first().evaluate((el) => el.classList.replace("course-card-unplaced", "course-card-hard"));
      const card = page.locator(".course-card-hard").first();
      expect(await card.locator("button").count()).toBeGreaterThan(0);
      // Opacity compounds down the tree and a child can't undo it.
      const opacities = await card.locator("button").evaluateAll((buttons) =>
        buttons
          .filter((b) => !b.closest("dialog"))
          .map((b) => {
            let product = 1;
            for (let el: Element | null = b; el; el = el.parentElement) product *= Number(getComputedStyle(el).opacity);
            return product;
          }),
      );
      expect(opacities.length).toBeGreaterThan(0);
      expect(opacities.every((o) => o === 1)).toBe(true);
      const codeColour = (locator: typeof card) =>
        locator.locator(".course-card-code").first().evaluate((el) => getComputedStyle(el).color);
      expect(await codeColour(card)).not.toBe(await codeColour(page.locator(".course-card-unplaced").first()));
      expect(await card.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
    } finally {
      await page.close();
    }
  });

  it("a placed row recedes without fading its buttons", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const card = page.locator(".placed-row").first();
      // Opacity compounds down the tree and a child can't undo it, so walk
      // every ancestor of each button, not just the button itself.
      const opacities = await card.locator("button").evaluateAll((buttons) =>
        buttons
          .filter((b) => !b.closest("dialog"))
          .map((b) => {
            let product = 1;
            for (let el: Element | null = b; el; el = el.parentElement) product *= Number(getComputedStyle(el).opacity);
            return product;
          }),
      );
      expect(opacities.length).toBeGreaterThan(0);
      expect(opacities.every((o) => o === 1)).toBe(true);
      const titleColour = (selector: string) =>
        page.locator(`${selector} strong`).first().evaluate((el) => getComputedStyle(el).color);
      expect(await titleColour(".placed-row")).not.toBe(await titleColour(".course-card-unplaced"));
    });
  });
});

describe("placed rows", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  // The one group COMP1130 belongs to: its label is also the start of
  // COMP1130's own title, so match the section by its heading instead.
  const group = (page: Page) =>
    page.locator(".requirement-group").filter({ has: page.getByRole("heading", { name: "Programming as Problem Solving", exact: true }) });
  const row = (page: Page) => group(page).locator(".placed-rows .placed-row");

  it("lists a completed course as one row below its group's unplaced cards, not draggable", async () => {
    await withPlan(desktop, async (page) => {
      expect(await row(page).count()).toBe(1);
      expect(await row(page).locator(".placed-row-status").innerText()).toBe("Completed S1 2027");
      const cards = group(page).locator(".available-courses .course-card");
      expect(await cards.count()).toBeGreaterThan(0);
      const lastCard = (await cards.last().boundingBox())!;
      expect((await row(page).boundingBox())!.y).toBeGreaterThanOrEqual(lastCard.y + lastCard.height);
      expect(await row(page).getAttribute("draggable")).toBeNull();
    });
  });

  it("says a planned course is planned, and its term locates it on the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      expect(await row(page).locator(".placed-row-status").innerText()).toBe("Planned S1 2027");
      const locate = page.getByRole("button", { name: /^COMP1130 is planned for S1 2027/ });
      expect(await locate.count()).toBe(1);
      await locate.click();
      await expect
        .poll(() => page.locator('[data-placed="COMP1130"]').evaluate((el) => el.classList.contains("course-card-highlighted")))
        .toBe(true);
    } finally {
      await page.close();
    }
  });

  it("opens Details from the row's title", async () => {
    await withPlan(desktop, async (page) => {
      const title = row(page).locator(".placed-row-title");
      expect(await title.getAttribute("title")).toBe("Programming as Problem Solving (Advanced)");
      expect(await row(page).getByRole("button", { name: "Programming as Problem Solving (Advanced), details", exact: true }).count()).toBe(1);
      await title.click();
      await page.locator("dialog[open]").waitFor(); // showModal() runs in an effect, after the click
      expect(await page.locator('dialog[open][aria-label="COMP1130 details"]').count()).toBe(1);
    });
  });

  it.each([
    ["wraps to two lines on a phone", phone, true],
    ["fits on one line in the wide sidebar", desktop, false],
  ])("%s", async (_name, viewport, twoLines) => {
    await withPlan(viewport, async (page) => {
      const target = row(page);
      await target.scrollIntoViewIfNeeded();
      const code = (await target.locator(".placed-row-code").boundingBox())!;
      const status = (await target.locator(".placed-row-status").boundingBox())!;
      if (twoLines) {
        expect(status.y).toBeGreaterThanOrEqual(code.y + code.height);
      } else {
        expect(Math.abs(status.y + status.height / 2 - (code.y + code.height / 2))).toBeLessThanOrEqual(4);
      }
      const title = await target.locator(".placed-row-title").evaluate((el) => ({
        overflows: el.scrollWidth > el.clientWidth,
        textOverflow: getComputedStyle(el).textOverflow,
      }));
      if (title.overflows) expect(title.textOverflow).toBe("ellipsis");
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("stays axe-clean", async () => {
    expect(await withPlan(desktop, axeViolations)).toEqual([]);
  });
});

describe("card header", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  async function withFreshPlan(viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i a timeline card leads with its code and units, and has no em-dash title", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      expect(await card.locator(".course-card-code").textContent()).toBe("COMP1130");
      const units = card.locator(".course-card-unit-count");
      expect(await units.locator('[aria-hidden="true"]').textContent()).toBe("6u");
      const spoken = units.locator(".visually-hidden");
      expect(await spoken.textContent()).toBe("6 units");
      expect(await spoken.evaluate((el) => getComputedStyle(el).width)).toBe("1px");

      const unitsBox = (await units.boundingBox())!;
      const headBox = (await card.locator(".course-card-head").boundingBox())!;
      expect(Math.abs(unitsBox.x + unitsBox.width - (headBox.x + headBox.width))).toBeLessThanOrEqual(1);

      // Every text node, the card's own Details dialog included.
      const dashed = await card.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const found: string[] = [];
        let seen = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          seen++;
          if (node.textContent?.includes(" — ")) found.push(node.textContent);
        }
        return { seen, found };
      });
      expect(dashed.seen).toBeGreaterThan(0);
      expect(dashed.found).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("a timeline card's title is a button that opens its details", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      const title = card.getByRole("button", { name: "Programming as Problem Solving (Advanced), details" });
      expect(await title.count()).toBe(1);
      expect(await title.getAttribute("aria-expanded")).toBeNull();
      await title.click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor(); // showModal() runs in an effect, after the click
      expect(await dialog.count()).toBe(1);
      expect(await dialog.getAttribute("aria-label")).toBe("COMP1130 details");
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i a sidebar card has a grip, no Details button, and a title that opens its details", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const card = page.locator(".course-card-unplaced").filter({ hasText: "COMP1100" });
      const grip = card.locator(".course-card-grip");
      expect(await grip.count()).toBe(1);
      expect(await grip.getAttribute("aria-hidden")).toBe("true");
      expect(await grip.getAttribute("tabindex")).toBeNull();
      expect(await card.getByRole("button", { name: "Details", exact: true }).count()).toBe(0);
      await card.locator(".course-card-title").click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor(); // showModal() runs in an effect, after the click
      expect(await dialog.count()).toBe(1);
      expect(await dialog.getAttribute("aria-label")).toBe("COMP1100 details");
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("a drag from a sidebar card's grip places it", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('.course-card-unplaced[data-drag-code="COMP3630"]').first();
      await card.scrollIntoViewIfNeeded();
      const grip = card.locator(".course-card-grip");
      await grip.hover();
      await page.mouse.down();
      const start = (await grip.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 });
      const term = Number(await page.locator("[data-term]:not(.term-disallowed)").first().getAttribute("data-term"));
      const open = (await page.locator(`[data-term="${term}"]`).boundingBox())!;
      await page.mouse.move(open.x + open.width / 2, open.y + open.height / 2, { steps: 10 });
      await page.mouse.move(open.x + open.width / 2 + 4, open.y + open.height / 2 + 4, { steps: 2 });
      await page.mouse.up();
      await expect.poll(() => page.locator('[data-placed="COMP3630"]').count()).toBe(1);
    });
  });

  it("is clean under axe on a fresh plan and on the example", async () => {
    await withFreshPlan(desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
    expect(await withPlan(desktop, axeViolations)).toEqual([]);
  });
});

describe("course card menu", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const cardMenu = (page: Page, code: string) =>
    page.locator(`[data-placed="${code}"]`).getByRole("button", { name: `More options for ${code}` });

  async function withFreshPlan(viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("keeps Move to, Details and Remove out of sight, behind a toggle with its own panel", async () => {
    const id = await planWithPlacement("COMP1130");
    await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP1100", term: 1 }),
    });
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      for (const name of ["Move to…", "Details", "Remove"]) {
        expect(await card.getByRole("button", { name, exact: true }).filter({ visible: true }).count()).toBe(0);
      }
      const controls = await cardMenu(page, "COMP1130").getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(await page.locator(`[id="${controls}"]`).count()).toBe(1);
      const other = await cardMenu(page, "COMP1100").getAttribute("aria-controls");
      expect(other).toBeTruthy();
      expect(other).not.toBe(controls);
    } finally {
      await page.close();
    }
  });

  it("lists Details, the Move to terms and Remove in order, and Escape closes it onto the toggle", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      const panel = page.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
      const order = await panel.evaluate((el) =>
        Array.from(el.children).map((child) =>
          child.matches("ul.card-menu-terms")
            ? `terms:${Array.from(child.querySelectorAll("button")).map((b) => b.textContent).join(",")}`
            : `${child.tagName.toLowerCase()}:${child.textContent}`,
        ),
      );
      expect(order[0]).toBe("button:Details");
      expect(order[1]).toBe("p:Move to");
      expect(order[2]).toMatch(/^terms:.+/);
      expect(order[2]).not.toContain("S1 2027");
      expect(order[3]).toBe("button:Remove");
      expect(order).toHaveLength(4);

      await panel.getByRole("button", { name: "Details" }).focus();
      await page.keyboard.press("Escape");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
        "More options for COMP1130",
      );
    });
  });

  it("Details in the menu closes it and opens the course's dialog", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      await page.locator('[data-placed="COMP1130"] .course-card-menu').getByRole("button", { name: "Details" }).click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor(); // showModal() runs in an effect, after the click
      expect(await dialog.getAttribute("aria-label")).toBe("COMP1130 details");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("a term in the menu moves the course there", async () => {
    await withFreshPlan(desktop, async (page) => {
      await cardMenu(page, "COMP1130").click();
      await page.locator('[data-placed="COMP1130"] .card-menu-terms').getByRole("button", { name: "S1 2028" }).click();
      await expect.poll(() => page.locator('[data-term="2"] [data-placed="COMP1130"]').count()).toBe(1);
    });
  });

  it("Remove in the menu removes the course, with Undo", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      await cardMenu(page, "COMP1130").click();
      await card.locator(".course-card-menu").getByRole("button", { name: "Remove" }).click();
      await expect.poll(() => card.count()).toBe(0);
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      expect(await toast.textContent()).toContain("Removed COMP1130");
      await toast.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => card.count()).toBe(1);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the open panel stays inside the timeline", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      const id = await toggle.getAttribute("aria-controls");
      const { panel, scroll } = await page.evaluate((panelId) => {
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        };
        return {
          panel: rect(document.getElementById(panelId!)!),
          scroll: rect(document.querySelector(".timeline-scroll")!),
        };
      }, id);
      expect(panel.width).toBeGreaterThan(0);
      expect(panel.left).toBeGreaterThanOrEqual(scroll.left);
      expect(panel.right).toBeLessThanOrEqual(scroll.right);
      expect(await horizontalOverflow(page)).toBe(0);

      // Horizontal bounds alone passed while .timeline-scroll (overflow-y:
      // hidden) clipped the panel's bottom off: check each button is really
      // what's under its own centre. scrollIntoView can scroll a hidden
      // overflow that a user never could, so no such ancestor may move.
      const hits = await page.evaluate((panelId) => {
        const buttons = Array.from(document.getElementById(panelId!)!.querySelectorAll("button"));
        return buttons.map((button) => {
          button.scrollIntoView({ block: "nearest" });
          const r = button.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const scrolledHidden: string[] = [];
          for (let el = button.parentElement; el; el = el.parentElement) {
            const oy = getComputedStyle(el).overflowY;
            if ((oy === "hidden" || oy === "clip") && el.scrollTop !== 0) scrolledHidden.push(el.className);
          }
          return { label: button.textContent, underCentre: !!hit && button.contains(hit), scrolledHidden };
        });
      }, id);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter((h) => !h.underCentre || h.scrolledHidden.length > 0)).toEqual([]);
    });
  });

  it("a floating card menu closes when the timeline scrolls, since it would be left behind", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
      await page.locator(".timeline-scroll").evaluate((el) => el.scrollBy({ left: 200 }));
      await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("is clean under axe with a card menu open", async () => {
    await withFreshPlan(desktop, async (page) => {
      await cardMenu(page, "COMP1130").click();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("a read-only plan renders no card menu and no Place in…, but titles still open Details", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator("[data-placed]").count()).toBeGreaterThan(0);
      expect(await page.locator(".course-card-menu").count()).toBe(0);
      expect(await page.getByRole("button", { name: "Place in…" }).count()).toBe(0);
      await page.locator("[data-placed] .course-card-title").first().click();
      await page.locator("dialog[open]").waitFor();
      expect(await page.locator("dialog[open]").count()).toBe(1);
    });
  });

  it("on /plan/example no timeline card shows a disabled button", async () => {
    await withPlan(desktop, async (page) => {
      const buttons = page.locator("[data-placed] button:not(dialog button)").filter({ visible: true });
      expect(await buttons.count()).toBeGreaterThan(0);
      expect(await page.locator("[data-placed] button:disabled:not(dialog button)").filter({ visible: true }).count()).toBe(0);
    });
  });

  it("keeps a soft card's prerequisite suggestions visible with the menu closed", async () => {
    const created = await fetch(new URL("/api/plans", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      redirect: "manual",
    });
    const id = created.headers.get("location")!.split("/").pop()!;
    await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP2100", term: 3 }),
    });
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const suggestions = page.locator('[data-placed="COMP2100"] .course-card-suggestions button');
      expect(await suggestions.count()).toBeGreaterThan(0);
      expect(await suggestions.first().isVisible()).toBe(true);
      expect(await cardMenu(page, "COMP2100").getAttribute("aria-expanded")).toBe("false");
    } finally {
      await page.close();
    }
  });
});

describe("family colours", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const FOUNDATIONS = "rgb(31, 47, 134)";
  const NEUTRAL = "rgb(141, 146, 153)";
  const GOLD = "rgb(190, 131, 14)";
  const rgb: Record<string, string> = {
    foundations: FOUNDATIONS,
    specialisation: "rgb(140, 95, 201)",
    advanced: "rgb(58, 143, 194)",
    ict: "rgb(176, 64, 125)",
    capstone: "rgb(61, 70, 80)",
    neutral: NEUTRAL,
  };

  const style = (page: Page, selector: string, prop: string) =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  it("strips a timeline card in its family colour", async () => {
    await withPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      expect(await card.getAttribute("data-family")).toBe("foundations");
      expect(await style(page, '[data-placed="COMP1130"]', "box-shadow")).toContain(FOUNDATIONS);
    });
  });

  it("gives a card counting toward Electives no strip", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator('[data-placed="INFS1001"]').getAttribute("data-family")).toBe("neutral");
      expect(await style(page, '[data-placed="INFS1001"]', "box-shadow")).toBe("none");
    });
  });

  it("puts a hidden family dot beside Counts toward, keeping the text", async () => {
    await withPlan(desktop, async (page) => {
      const selector = '[data-placed="COMP1130"] .course-card-allocation .family-dot';
      expect(await page.locator(selector).count()).toBe(1);
      expect(await style(page, selector, "background-color")).toBe(FOUNDATIONS);
      expect(await page.locator(selector).getAttribute("aria-hidden")).toBe("true");
      expect(await page.locator('[data-placed="COMP1130"] .course-card-allocation').textContent()).toContain(
        "Counts toward Programming as Problem Solving",
      );
    });
  });

  it("dots top-level headings only, and not Electives", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator('[data-group="prog-a"] > h2 .family-dot').count()).toBe(1);
      expect(await page.locator('[data-group="spec"] > h2 .family-dot').count()).toBe(1);
      expect(await page.locator('[data-group="electives"] > h2').count()).toBe(1);
      expect(await page.locator('[data-group="electives"] > h2 .family-dot').count()).toBe(0);
      expect(await page.locator("[data-group] h3").count()).toBeGreaterThan(0);
      expect(await page.locator(":is(h3, h4, h5, h6) .family-dot").count()).toBe(0);
    });
  });

  it("keeps sidebar cards, compact rows and search results unstriped", async () => {
    await withPlan(desktop, async (page) => {
      const shadows = await page
        .locator(".available-courses .course-card, .placed-row")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
      expect(await page.locator(".available-courses .course-card").count()).toBeGreaterThan(0);
      expect(await page.locator(".placed-row").count()).toBeGreaterThan(0);
      expect(shadows.filter((s) => s !== "none")).toEqual([]);
    });
  });

  it("colours each group's progress bar by family, and leaves Total and the checks gold", async () => {
    await withPlan(desktop, async (page) => {
      expect(await style(page, '[data-group="prog-a"] .progress-bar-completed', "background-color")).toBe(FOUNDATIONS);
      expect(await style(page, '[data-group="prog-a"] .progress-bar-planned', "background-color")).not.toBe(
        "rgb(245, 237, 222)",
      );
      expect(await style(page, '[data-group="electives"] .progress-bar-completed', "background-color")).toBe(NEUTRAL);
      const total = page.locator(".requirement-group").filter({ has: page.locator("h2", { hasText: /^Total$/ }) });
      expect(await total.count()).toBe(1);
      expect(
        await total.locator(".progress-bar-completed").first().evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe(GOLD);
      expect(await style(page, ".checks-list .progress-bar-completed", "background-color")).toBe(GOLD);
      // The example's COMP2620 counts toward the AI specialisation's foundations.
      expect(await style(page, '[data-group="arin-a"] .progress-bar-completed', "background-color")).toBe(
        "rgb(140, 95, 201)",
      );
      // Its completed segment is 0% wide (COMP2620 is planned), so check the
      // planned segment actually shows, in violet.
      const planned = page.locator('[data-group="arin-a"] .progress-bar-planned').first();
      expect(await planned.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(0);
      expect(await planned.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(140, 95, 201)");
    });
  });

  it("hatches every family bar's planned segment, and leaves Total and the checks plain", async () => {
    await withPlan(desktop, async (page) => {
      const bars = await page
        .locator("[data-group] > .progress-bar[data-family]")
        .evaluateAll((els) =>
          els.map((el) => ({
            family: el.getAttribute("data-family")!,
            image: getComputedStyle(el.querySelector(".progress-bar-planned")!).backgroundImage,
          })),
        );
      expect(bars.length).toBeGreaterThan(0);
      for (const { family, image } of bars) {
        expect(image, family).toContain("repeating-linear-gradient");
        expect(image, family).toContain(rgb[family]);
      }
      const total = page.locator(".requirement-group").filter({ has: page.locator("h2", { hasText: /^Total$/ }) });
      expect(
        await total.locator(".progress-bar-planned").first().evaluate((el) => getComputedStyle(el).backgroundImage),
      ).toBe("none");
      expect(await style(page, ".checks-list .progress-bar-planned", "background-image")).toBe("none");
    });
  });

  it("draws a per-term family bar with a text equivalent", async () => {
    await withPlan(desktop, async (page) => {
      const bars = page.locator("[data-term] .term-bar");
      expect(await bars.count()).toBe(8);
      for (const bar of await bars.all()) {
        expect(await bar.getAttribute("role")).toBe("img");
        expect(await bar.getAttribute("aria-label")).toMatch(/^(\d|No units planned$)/);
      }
      const first = page.locator('[data-term="0"] .term-bar');
      const segments = first.locator(".term-bar-segment");
      expect(await segments.count()).toBeGreaterThan(0);
      const { sum, width } = await first.evaluate((el) => ({
        sum: [...el.querySelectorAll(".term-bar-segment")].reduce((t, s) => t + s.getBoundingClientRect().width, 0),
        width: el.clientWidth,
      }));
      expect(Math.abs(sum - width)).toBeLessThanOrEqual(1);
      const familyColours = [
        FOUNDATIONS,
        "rgb(140, 95, 201)",
        "rgb(58, 143, 194)",
        "rgb(176, 64, 125)",
        "rgb(61, 70, 80)",
        NEUTRAL,
      ];
      expect(familyColours).toContain(
        await segments.first().evaluate((el) => getComputedStyle(el).backgroundColor),
      );
    });
  });

  it("hatches the family bar of planned terms only", async () => {
    await withPlan(desktop, async (page) => {
      const segments = await page.locator("[data-term] .term-bar-segment").evaluateAll((els) =>
        els.map((el) => ({
          term: Number(el.closest("[data-term]")!.getAttribute("data-term")),
          family: el.getAttribute("data-family")!,
          image: getComputedStyle(el).backgroundImage,
        })),
      );
      // The example is completed through S2 2027 (cutoff 2).
      const completed = segments.filter((s) => s.term < 2);
      const planned = segments.filter((s) => s.term >= 2);
      expect(completed.length).toBeGreaterThan(0);
      expect(planned.length).toBeGreaterThan(0);
      for (const s of completed) expect(s.image, `term ${s.term} ${s.family}`).toBe("none");
      for (const s of planned) {
        expect(s.image, `term ${s.term} ${s.family}`).toContain("repeating-linear-gradient");
        expect(s.image, `term ${s.term} ${s.family}`).toContain(rgb[s.family]);
      }
    });
  });

  it("stays axe-clean", async () => {
    await withPlan(desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});

describe("show a group in the sidebar", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const highlighted = (page: Page) =>
    page.locator(".requirement-highlighted").evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
  const countsToward = (page: Page, code: string) => page.locator(`[data-placed="${code}"] .course-card-allocation`);

  it("reveals, focuses and briefly highlights a top-level group", async () => {
    await withPlan(desktop, async (page) => {
      const button = countsToward(page, "COMP1130");
      expect(await button.evaluate((el) => el.tagName)).toBe("BUTTON");
      await button.click();
      await expect.poll(() => highlighted(page)).toEqual(["prog-a"]);
      expect(
        await page.evaluate(
          () => document.activeElement === document.querySelector('[data-group="prog-a"] > h2 .section-toggle'),
        ),
      ).toBe(true);
      await page.waitForTimeout(3000);
      expect(await highlighted(page)).toEqual([]);
    });
  });

  it("scrolls to and focuses the exact nested group", async () => {
    await withPlan(desktop, async (page) => {
      await countsToward(page, "COMP2620").click();
      await expect.poll(() => highlighted(page)).toEqual(["arin-a"]);
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(
        "Artificial Intelligence — foundations (max 12)",
      );
      const inside = () =>
        page.evaluate(() => {
          const t = document.querySelector('[data-group="arin-a"]')!.getBoundingClientRect();
          const r = document.querySelector("#requirements")!.getBoundingClientRect();
          // "nearest" lands the group flush with an edge, so allow a
          // pixel of layout rounding.
          return t.top >= r.top - 1 && t.bottom <= r.bottom + 1;
        });
      await expect.poll(inside).toBe(true);
    });
  });

  it("clears an earlier highlight when a newer jump lands", async () => {
    await withPlan(desktop, async (page) => {
      await countsToward(page, "COMP1130").click();
      await countsToward(page, "COMP2620").click();
      await expect.poll(() => highlighted(page)).toContain("arin-a");
      expect(await highlighted(page)).toEqual(["arin-a"]);
    });
  });

  it("expands hidden requirements first", async () => {
    const page = await openPage(browser, planUrl(), desktop, { storage: { "panel-reqs": "collapsed" } });
    try {
      expect(await page.evaluate(() => document.documentElement.dataset.reqs)).toBe("collapsed");
      await countsToward(page, "COMP1130").click();
      await expect.poll(() => highlighted(page)).toEqual(["prog-a"]);
      expect(await page.evaluate(() => document.documentElement.dataset.reqs)).not.toBe("collapsed");
    } finally {
      await page.close();
    }
  });

  it("expands a compacted section first", async () => {
    const page = await openPage(browser, planUrl(), desktop, {
      storage: { "sidebar-compact": '["group-prog-a"]' },
    });
    try {
      const toggle = page.locator('[data-group="prog-a"] > h2 .section-toggle');
      await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
      await countsToward(page, "COMP1130").click();
      await expect.poll(() => highlighted(page)).toEqual(["prog-a"]);
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    } finally {
      await page.close();
    }
  });

  it("scrolls the stacked strip sideways to the group on a phone", async () => {
    await withPlan({ width: 390, height: 844 }, async (page) => {
      const button = countsToward(page, "COMP2620");
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect.poll(() => highlighted(page)).toEqual(["arin-a"]);
      const intersects = () =>
        page.evaluate(() => {
          const t = document.querySelector('[data-group="arin-a"]')!.getBoundingClientRect();
          const s = document.querySelector(".requirements-scroll")!.getBoundingClientRect();
          return t.right > s.left && t.left < s.right;
        });
      await expect.poll(intersects).toBe(true);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("leaves Not counting as plain text", async () => {
    const id = await planWithPlacement("COMP1100");
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP1130", term: 0 }),
    });
    expect(placed.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const allocation = countsToward(page, "COMP1130");
      expect(await allocation.textContent()).toBe("Not counting toward any requirement");
      expect(await allocation.evaluate((el) => el.tagName)).toBe("P");
    } finally {
      await page.close();
    }
  });

  const checksHighlighted = (page: Page) =>
    page.locator(".requirement-highlighted").evaluateAll((els) => els.map((el) => el.getAttribute("data-check")));
  const outstandingLink = (page: Page, text: RegExp) => page.locator(".outstanding-list button", { hasText: text });

  it("jumps from a What's left check item to its check row", async () => {
    await withPlan(desktop, async (page) => {
      const link = outstandingLink(page, /^At least 12 units of TDP-tagged courses/);
      expect(await link.count()).toBe(1);
      await link.click();
      await expect.poll(() => checksHighlighted(page)).toEqual(["tdp-min"]);
      expect(
        await page.evaluate(() => document.activeElement === document.querySelector('[data-check="tdp-min"] > h4')),
      ).toBe(true);
    });
  });

  it("expands a compacted Total before jumping to a check", async () => {
    const page = await openPage(browser, planUrl(), desktop, { storage: { "sidebar-compact": '["total"]' } });
    try {
      const toggle = page.locator('.section-toggle[aria-controls="sidebar-section-total"]');
      await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
      const link = outstandingLink(page, /^At least 12 units of TDP-tagged courses/);
      expect(await link.count()).toBe(1);
      await link.click();
      await expect.poll(() => checksHighlighted(page)).toEqual(["tdp-min"]);
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    } finally {
      await page.close();
    }
  });

  it.each([
    ["a check row", "tdp-min", "check"],
    ["a nested group", "arin-a", "group"],
    ["a top-level group", "prog-a", "group"],
  ])("the highlight on %s doesn't cover its text", async (_name, id, kind) => {
    await withPlan(desktop, async (page) => {
      const selector = kind === "check" ? `[data-check="${id}"]` : `[data-group="${id}"]`;
      const el = page.locator(selector);
      expect(await el.count()).toBe(1);
      await el.evaluate((node) => node.classList.add("requirement-highlighted"));
      // An outline drawn inside the box reaches (-offset) px in from the
      // border edge; past the border and padding it's over the content.
      const clearance = await el.evaluate((node) => {
        const s = getComputedStyle(node);
        const reach = Math.max(0, -parseFloat(s.outlineOffset));
        const room = Math.min(
          ...(["Top", "Right", "Bottom", "Left"] as const).map(
            (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) + parseFloat(s.getPropertyValue(`padding-${side.toLowerCase()}`)),
          ),
        );
        return { reach, room, width: parseFloat(s.outlineWidth) };
      });
      expect(clearance.width).toBeGreaterThan(0);
      expect(clearance.reach).toBeLessThanOrEqual(clearance.room);
    });
  });

  it("jumps from a What's left group item to its group", async () => {
    const created = await fetch(new URL("/api/plans", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      redirect: "manual",
    });
    const id = created.headers.get("location")!.split("/").pop()!;
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      expect(await page.locator(".outstanding-list button").count()).toBeGreaterThan(0);
      const first = page.locator(".outstanding-list button").first();
      // A fresh plan's first item is a leaf group's shortfall ("<label>: N more units needed").
      const label = (await first.textContent())!.split(":")[0];
      await first.click();
      await expect.poll(() => highlighted(page)).toHaveLength(1);
      const heading = await page
        .locator(".requirement-highlighted")
        .evaluate((el) => el.querySelector(":scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6")?.textContent);
      expect(heading).toBe(label);
    } finally {
      await page.close();
    }
  });

  it("stays axe-clean", async () => {
    await withPlan(desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});

describe("group heading highlights its courses", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const receded = (page: Page) =>
    page
      .locator(".course-card-receded")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-placed")!).sort());
  const toggle = (page: Page, id: string) => page.locator(`[data-group="${id}"] > h2 .section-toggle`);
  const scrollState = (page: Page) =>
    page.evaluate(() => ({
      timeline: document.querySelector(".timeline-scroll")!.scrollLeft,
      reqs: document.querySelector("#requirements")!.scrollTop,
    }));

  it("recedes nothing until a heading is hovered", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator("[data-placed]").count()).toBeGreaterThan(0);
      expect(await receded(page)).toEqual([]);
    });
  });

  it("recedes other groups' cards on hover, without moving focus or scroll, and restores on leave", async () => {
    await withPlan(desktop, async (page) => {
      // Playwright scrolls a hover target into view itself; do that first so
      // the baseline measures only what the app does.
      await toggle(page, "prog-a").scrollIntoViewIfNeeded();
      const before = await scrollState(page);
      await toggle(page, "prog-a").hover();
      await expect.poll(() => receded(page)).toContain("COMP2100");
      expect(await receded(page)).not.toContain("COMP1130");
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      expect(await scrollState(page)).toEqual(before);
      await page.hover("h1");
      await expect.poll(() => receded(page)).toEqual([]);
    });
  });

  it("does the same on keyboard focus, and restores on blur", async () => {
    await withPlan(desktop, async (page) => {
      await toggle(page, "prog-a").scrollIntoViewIfNeeded();
      const before = await scrollState(page);
      await toggle(page, "prog-a").focus();
      await expect.poll(() => receded(page)).toContain("COMP2100");
      expect(await receded(page)).not.toContain("COMP1130");
      expect(await scrollState(page)).toEqual(before);
      await toggle(page, "prog-a").blur();
      await expect.poll(() => receded(page)).toEqual([]);
    });
  });

  it("keeps a nested group's cards when its top-level heading is hovered", async () => {
    await withPlan(desktop, async (page) => {
      await toggle(page, "spec").hover();
      await expect.poll(() => receded(page)).toContain("COMP2100");
      expect(await receded(page)).not.toContain("COMP2620");
    });
  });

  it("recedes a card by colour, without fading its buttons", async () => {
    await withPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP2100"]');
      const codeColour = () => card.locator(".course-card-code").evaluate((el) => getComputedStyle(el).color);
      const atRest = await codeColour();
      await toggle(page, "prog-a").hover();
      await expect.poll(() => receded(page)).toContain("COMP2100");
      expect(await codeColour()).not.toBe(atRest);
      const opacities = await card.locator("button").evaluateAll((buttons) =>
        buttons
          .filter((b) => !b.closest("dialog"))
          .map((b) => {
            let product = 1;
            for (let el: Element | null = b; el; el = el.parentElement) product *= Number(getComputedStyle(el).opacity);
            return product;
          }),
      );
      expect(opacities.length).toBeGreaterThan(0);
      expect(opacities.every((o) => o === 1)).toBe(true);
    });
  });
});

describe("progress bars", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  // Every bar in the requirements sidebar, read from its ARIA attributes.
  async function bars(page: Page) {
    return page.locator('#requirements [role="progressbar"]').evaluateAll((els) =>
      els.map((el) => ({
        label: el.getAttribute("aria-label"),
        now: Number(el.getAttribute("aria-valuenow")),
        max: Number(el.getAttribute("aria-valuemax")),
        text: el.getAttribute("aria-valuetext") ?? "",
      })),
    );
  }

  it("every bar's value stays within its range", async () => {
    await withPlan(desktop, async (page) => {
      const found = await bars(page);
      expect(found.length).toBeGreaterThan(0);
      for (const bar of found) expect(bar.now, `${bar.label}: ${bar.now} > ${bar.max}`).toBeLessThanOrEqual(bar.max);
    });
  });

  // "example" is the seeded plan; each other value is a fresh plan with that
  // specialisation chosen, so every cap-only group is rendered at least once.
  it.each(["example", "arin", "hccc", "syar", "thcs"])("no bar is measured against nothing (%s)", async (choice) => {
    let id = "example";
    if (choice !== "example") {
      const created = await fetch(new URL("/api/plans", baseUrl), {
        method: "POST",
        headers: { origin: baseUrl },
        redirect: "manual",
      });
      id = created.headers.get("location")!.split("/").pop()!;
      const chosen = await fetch(new URL(`/api/plans/${id}/choices`, baseUrl), {
        method: "PUT",
        headers: { origin: baseUrl, "content-type": "application/json" },
        body: JSON.stringify({ groupId: "spec", childId: choice }),
      });
      expect(chosen.status).toBe(200);
    }
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const found = await bars(page);
      expect(found.length).toBeGreaterThan(0);
      for (const bar of found) {
        expect(bar.max > 0 || bar.now === 0, `${bar.label}: ${bar.now} of ${bar.max}`).toBe(true);
        expect(bar.text, bar.label ?? "").not.toMatch(/of 0$/);
      }
    } finally {
      await page.close();
    }
  });
});
