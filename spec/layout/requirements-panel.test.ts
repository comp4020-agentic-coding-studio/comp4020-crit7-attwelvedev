import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { baseUrl, browser, planUrl, planWithPlacement, settle, useBrowser, withPlan } from "./helpers";

useBrowser();

describe("requirements sidebar collapse", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const reqsCollapsed = { storage: { "panel-reqs": "collapsed" } };
  const asideWidth = async (page: Page) => {
    await settle(page);
    return page.evaluate(() => document.querySelector<HTMLElement>('aside[aria-label="requirements"]')!.offsetWidth);
  };
  const timelineWidth = async (page: Page) => {
    await settle(page);
    return page.evaluate(() => document.querySelector<HTMLElement>(".planner-timeline-area")!.offsetWidth);
  };
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

  // Stacked, the saved fold doesn't apply: a phone switches regions with
  // tabs (spec/layout/phone-layout.test.ts, "no split handle or collapsed bar").

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

describe("requirements rail fill", { timeout: 30_000 }, () => {
  it("at 1920×1080 the fill's height follows the program's progress", async () => {
    const page = await openPage(browser, planUrl(), { width: 1920, height: 1080 }, {
      storage: { "panel-reqs": "collapsed" },
    });
    try {
      const ratio = await page.evaluate(() => {
        const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
        return rect(".reqs-rail-completed").height / rect(".reqs-rail-bar").height;
      });
      expect(Math.abs(ratio - 0.25)).toBeLessThanOrEqual(0.02);
    } finally {
      await page.close();
    }
  });

  it.each([
    ["at 1 column", { "panel-reqs-w": "280" }],
    ["collapsed", { "panel-reqs": "collapsed" }],
  ])("passes axe %s", async (_state, storage) => {
    const page = await openPage(browser, planUrl(), { width: 1920, height: 1080 }, { storage });
    try {
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});

describe("hide requirements on the handle", { timeout: 30_000 }, () => {
  // Side by side only: phones switch regions with tabs instead.
  it("at 1920×1080 rides the resize handle, not the requirements", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const named = page.getByRole("button", { name: "Hide requirements", exact: true });
      expect(await named.evaluate((el) => el.classList.contains("reqs-hide"))).toBe(true);
      const r = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const button = document.querySelector("button.reqs-hide")!;
        return {
          insideAside: Boolean(button.closest("#requirements")),
          button: rect("button.reqs-hide").toJSON() as DOMRect,
          handle: rect('[role="separator"][aria-controls="requirements"]').toJSON() as DOMRect,
          groupGap: rect(".requirement-group").top - rect("#requirements").top,
        };
      });
      expect(r.insideAside).toBe(false);
      expect(r.button.width).toBeGreaterThanOrEqual(44);
      expect(r.button.height).toBeGreaterThanOrEqual(44);
      const centre = (b: DOMRect) => b.left + b.width / 2;
      expect(Math.abs(centre(r.button) - centre(r.handle))).toBeLessThanOrEqual(2);
      expect(r.button.top - r.handle.top).toBeLessThanOrEqual(16);
      expect(r.groupGap).toBeLessThanOrEqual(8);
      expect(await axeViolations(page)).toEqual([]);
    });
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

// WR24–WR25: an untracked check isn't listed as left to do; every check
// says in plain words where it stands, under its bar.
describe("requirements order and check notes", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  it("What's left has no TDP line", async () => {
    await withPlan(desktop, async (page) => {
      const text = await page.locator(".outstanding-panel").innerText();
      expect(text).not.toContain("TDP");
    });
  });

  it("Checks show bar and note", async () => {
    await withPlan(desktop, async (page) => {
      const checks = await page.evaluate(() =>
        [...document.querySelectorAll("li[data-check]")].map((li) => ({
          id: li.getAttribute("data-check"),
          bars: li.querySelectorAll('[role="progressbar"]').length,
          caption: li.querySelector(".progress-bar-text")?.textContent ?? null,
          note: li.querySelector("p.check-note")?.textContent ?? null,
        })),
      );
      // The example plan: 48 units at 1000-level against a 60 maximum, 60
      // planned at 4000-level against a 48 minimum, and TDP untracked. The
      // caption is the figures alone: the note already says how far over
      // or under the check is (Task 14 review, 2026-09-29).
      expect(checks).toEqual([
        { id: "lvl1000-max", bars: 1, caption: "48 completed, 0 planned of up to 60", note: "Room for 12 more units" },
        { id: "comp4000-min", bars: 1, caption: "0 completed, 60 planned of 48", note: "Covered, with 12 units to spare" },
        { id: "tdp-min", bars: 0, caption: null, note: "Not tracked yet. Check it on Programs & Courses." },
      ]);
    });
  });
});
