import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { ROUTES } from "../routes";
import { baseUrl, browser, openSearch, planUrl, useBrowser, withPlan } from "./helpers";

useBrowser();

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
  ])("at %i×%i the palette's placeholder isn't cut off", async (width, height) => {
    const fit = await withPlan({ width, height }, async (page) => {
      await openSearch(page);
      return page.evaluate(() => {
        // An input never scrolls its placeholder, so measure the text itself
        // in the input's own font against the input's content box.
        const input = document.querySelector<HTMLInputElement>(".course-search-field input")!;
        const style = getComputedStyle(input);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = style.font;
        const text = context.measureText(input.placeholder).width;
        const box = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return { text: Math.ceil(text), box };
      });
    });
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
            // Flush is fine: stretched cards in a nested group end on its
            // edge, as its placed rows do (user ruling, 2026-09-29). Past it isn't.
            return !group || card.getBoundingClientRect().right > group.getBoundingClientRect().right + 0.5;
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
