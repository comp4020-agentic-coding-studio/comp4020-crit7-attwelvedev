import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { Browser, Page } from "playwright";
import { axeViolations, horizontalOverflow, launch, openPage, type Viewport } from "./browser";

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

  it("ignores the saved state on a phone, where there's no toggle", async () => {
    const page = await openPage(browser, planUrl(), { width: 390, height: 844 }, navHidden);
    try {
      expect(await page.locator('nav[aria-label="site"]').isVisible()).toBe(true);
      expect(await page.locator("button.nav-hide").isVisible()).toBe(false);
      expect(await page.locator("button.nav-show").isVisible()).toBe(false);
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
