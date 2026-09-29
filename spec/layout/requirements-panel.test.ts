import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow } from "../browser";
import { baseUrl, browser, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

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

// The stacked split handle. Side by side, the workspace dividers resize
// the regions instead (spec/layout/workspace-resize.test.ts).
describe("requirements resize handle", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  const separator = (page: Page) => page.getByRole("separator", { name: "Resize requirements" });
  const asideWidth = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>("#requirements")!.offsetWidth);
  const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

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
    ["at 1 column", { "panel-reqs-w": "280" }],
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

describe("hide requirements on the handle", { timeout: 30_000 }, () => {
  // Side by side the handle is the Requirements divider; stacked, the split handle.
  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i rides the resize handle, not the requirements", async (width, height) => {
    await withPlan({ width, height }, async (page) => {
      const named = page.getByRole("button", { name: "Hide requirements", exact: true });
      expect(await named.evaluate((el) => el.classList.contains("reqs-hide"))).toBe(true);
      const r = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const button = document.querySelector("button.reqs-hide")!;
        return {
          insideAside: Boolean(button.closest("#requirements")),
          stacked: document.querySelector(".reqs-resize") !== null,
          button: rect("button.reqs-hide").toJSON() as DOMRect,
          handle: rect('[role="separator"][aria-controls="requirements"]').toJSON() as DOMRect,
          panes: rect(".planner-panes").toJSON() as DOMRect,
          groupGap: rect(".requirement-group").top - rect("#requirements").top,
        };
      });
      expect(r.insideAside).toBe(false);
      expect(r.button.width).toBeGreaterThanOrEqual(44);
      expect(r.button.height).toBeGreaterThanOrEqual(44);
      const centre = (b: DOMRect, axis: "x" | "y") => (axis === "x" ? b.left + b.width / 2 : b.top + b.height / 2);
      const axis = r.stacked ? "y" : "x";
      expect(Math.abs(centre(r.button, axis) - centre(r.handle, axis))).toBeLessThanOrEqual(2);
      if (r.stacked) expect(r.panes.right - r.button.right).toBeLessThanOrEqual(16);
      else expect(r.button.top - r.handle.top).toBeLessThanOrEqual(16);
      expect(r.groupGap).toBeLessThanOrEqual(8);
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("sits in a row above the requirements where there's no handle", async () => {
    const page = await openPage(browser, planUrl(), { width: 700, height: 400 });
    try {
      const hide = page.locator("button.reqs-hide");
      expect(await hide.isVisible()).toBe(true);
      const box = (await hide.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      const asideTop = (await page.locator("#requirements").boundingBox())!.y;
      expect(box.y + box.height).toBeLessThanOrEqual(asideTop + 1);

      // Scrolled up under the sticky timeline, it goes under like the
      // requirements do instead of floating over the timeline's cards.
      const covered = await page.evaluate(async () => {
        const button = document.querySelector("button.reqs-hide")!;
        window.scrollBy(0, button.getBoundingClientRect().top - 100);
        await new Promise(requestAnimationFrame);
        const b = button.getBoundingClientRect();
        const t = document.querySelector(".planner-timeline-area")!.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { overlaps: b.top < t.bottom && b.bottom > t.top, underTimeline: Boolean(el?.closest(".planner-timeline-area")) };
      });
      expect(covered.overlaps).toBe(true);
      expect(covered.underTimeline).toBe(true);
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
