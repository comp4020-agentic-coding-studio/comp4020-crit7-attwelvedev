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
  ])("at %i×%i with %o the page doesn't scroll either way", async (width, height, storage) => {
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
  ])("ignores the saved state in the stacked layout at %i×%i", async (width, height) => {
    const page = await openPage(browser, planUrl(), { width, height }, reqsCollapsed);
    try {
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(true);
      expect(await page.locator(".reqs-rail").isVisible()).toBe(false);
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

describe("requirements resize handle", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
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

  it("isn't shown in the stacked layout", async () => {
    const page = await openPage(browser, planUrl(), { width: 390, height: 844 });
    try {
      expect(await separator(page).isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  });

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
