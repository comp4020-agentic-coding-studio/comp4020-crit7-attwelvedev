import { describe, expect, it } from "vitest";
import type { Locator, Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow } from "../browser";
import { baseUrl, browser, detailsPanel, planUrl, planWithPlacement, settle, useBrowser } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };
const courseUrl = () => `${planUrl()}?course=COMP2100`;
const reqsDivider = (page: Page) => page.getByRole("separator", { name: "Resize requirements" });
const detailsDivider = (page: Page) => page.getByRole("separator", { name: "Resize course details" });
const asideWidth = async (page: Page) => {
  await settle(page);
  return page.evaluate(() => document.querySelector<HTMLElement>("#requirements")!.getBoundingClientRect().width);
};
const panelWidth = async (page: Page) => {
  await settle(page);
  return detailsPanel(page).evaluate((el) => el.getBoundingClientRect().width);
};
const tracks = async (page: Page, selector: string) => {
  await settle(page);
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el).gridTemplateColumns.split(" ").length : null;
  }, selector);
};
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

// Presses on the divider (below the Requirements chevron at its top) and
// moves the pointer dx sideways, releasing unless told not to.
async function dragBy(page: Page, divider: Locator, dx: number, release = true) {
  await settle(page);
  const box = (await divider.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 8 });
  if (release) await page.mouse.up();
}

async function onPage(url: string, check: (page: Page) => Promise<void>, storage?: Record<string, string>) {
  const page = await openPage(browser, url, desktop, { storage });
  try {
    await check(page);
  } finally {
    await page.close();
  }
}

describe("workspace dividers", { timeout: 30_000 }, () => {
  it("two separators when details are open, one when closed, each a 44px target", async () => {
    await onPage(planUrl(), async (page) => {
      expect(await page.getByRole("separator").count()).toBe(1);
      expect(await reqsDivider(page).getAttribute("aria-orientation")).toBe("vertical");
      expect(await reqsDivider(page).getAttribute("aria-controls")).toBe("requirements");
    });
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      expect(await page.getByRole("separator").count()).toBe(2);
      expect(await detailsDivider(page).getAttribute("aria-orientation")).toBe("vertical");
      expect(await detailsDivider(page).getAttribute("aria-controls")).toBe("course-details");
      for (const divider of [reqsDivider(page), detailsDivider(page)]) {
        const box = (await divider.boundingBox())!;
        const hits = await divider.evaluate(
          // A 44px area centred on the line covers [-22, 22) from its centre.
          (el, [x, y]) => [-22, 0, 21.9].map((dx) => document.elementFromPoint(x + dx, y)?.closest('[role="separator"]') === el),
          [box.x + box.width / 2, box.y + box.height * 0.6],
        );
        expect(hits).toEqual([true, true, true]);
      }
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("dragging the requirements divider resizes freely", async () => {
    await onPage(planUrl(), async (page) => {
      await dragBy(page, reqsDivider(page), 600 - (await asideWidth(page)));
      expect(Math.abs((await asideWidth(page)) - 600)).toBeLessThanOrEqual(1);
      await expect.poll(() => stored(page, "panel-reqs-w")).toBe("600");
      expect(await reqsDivider(page).getAttribute("aria-valuetext")).toBe("600 px");
    });
  });

  it("soft snap: releasing near the two-column width lands on it", async () => {
    await onPage(planUrl(), async (page) => {
      await dragBy(page, reqsDivider(page), 510 - (await asideWidth(page)));
      expect(Math.round(await asideWidth(page))).toBe(498);
      expect(await tracks(page, '.available-courses[data-columns="3"]')).toBe(2);
      expect(await reqsDivider(page).getAttribute("aria-valuetext")).toBe("Two card columns");
    });
  });

  it("shows a size label while dragging, gone after release", async () => {
    await onPage(planUrl(), async (page) => {
      await dragBy(page, reqsDivider(page), 505 - (await asideWidth(page)), false);
      const tip = page.locator(".size-tip");
      expect(await tip.isVisible()).toBe(true);
      expect(await tip.textContent()).toBe("Two card columns");
      await page.mouse.up();
      expect(await tip.count()).toBe(0);
    });
  });

  it("folds past the minimum, and dragging the rail outward unfolds it", async () => {
    await onPage(planUrl(), async (page) => {
      await dragBy(page, reqsDivider(page), -650, false);
      expect(await page.locator(".size-tip").textContent()).toBe("Release to fold requirements");
      await page.mouse.up();
      const rail = page.locator(".reqs-rail");
      expect(await rail.isVisible()).toBe(true);
      expect(await rail.getAttribute("aria-expanded")).toBe("false");
      expect(Math.round(await asideWidth(page))).toBe(48);
      expect(await reqsDivider(page).getAttribute("aria-valuetext")).toBe("Folded");
      await expect.poll(() => stored(page, "panel-reqs")).toBe("collapsed");

      await dragBy(page, reqsDivider(page), 552);
      expect(await rail.isVisible()).toBe(false);
      expect(Math.abs((await asideWidth(page)) - 600)).toBeLessThanOrEqual(1);
      await expect.poll(() => stored(page, "panel-reqs")).toBeNull();
    });
  });

  it("the details divider snaps to two columns, and the body follows", async () => {
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      expect(await tracks(page, ".details-body")).toBe(1);
      const wide = page.locator(".details-nav button[aria-pressed]");
      expect(await wide.getAttribute("aria-pressed")).toBe("false");
      await dragBy(page, detailsDivider(page), -(690 - (await panelWidth(page))));
      expect(Math.round(await panelWidth(page))).toBe(680);
      expect(await tracks(page, ".details-body")).toBe(2);
      expect(await wide.getAttribute("aria-pressed")).toBe("true");
      expect(await detailsDivider(page).getAttribute("aria-valuetext")).toBe("Two-column details");
    });
  });

  it("the wide toggle switches details between 440 and 760", async () => {
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      const wide = page.locator(".details-nav button[aria-pressed]");
      expect(await wide.getAttribute("aria-label")).toBe("Widen details");
      await wide.click();
      await expect.poll(async () => Math.round(await panelWidth(page))).toBe(760);
      expect(await wide.getAttribute("aria-label")).toBe("Narrow details");
      await wide.click();
      await expect.poll(async () => Math.round(await panelWidth(page))).toBe(440);
    });
  });

  it("the panel docks as the third grid column, clear of the plan header", async () => {
    const id = await planWithPlacement("COMP1130");
    await onPage(new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, async (page) => {
      const panel = detailsPanel(page);
      await panel.waitFor();
      expect(await panel.getAttribute("data-mode")).toBe("docked");
      expect(await panel.evaluate((el) => el.parentElement!.classList.contains("planner-panes"))).toBe(true);
      const divider = (await detailsDivider(page).boundingBox())!;
      const box = (await panel.boundingBox())!;
      expect(Math.abs(box.x - (divider.x + divider.width))).toBeLessThanOrEqual(1);
      const covered = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            ".plan-actions button.completed-toggle, .plan-actions .history-button, .plan-actions button.more-options-toggle",
          ),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button") !== el;
          })
          .map((el) => el.className),
      );
      expect(
        await page.locator(".plan-actions").locator("button.completed-toggle, .history-button, button.more-options-toggle").count(),
      ).toBe(4);
      expect(covered).toEqual([]);
    });
  });

  it("release to close: dragging the details divider far right closes the panel", async () => {
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      await dragBy(page, detailsDivider(page), 380, false);
      expect(await page.locator(".size-tip").textContent()).toBe("Release to close details");
      await page.mouse.up();
      await expect.poll(() => detailsPanel(page).count()).toBe(0);
      await expect.poll(() => new URL(page.url()).searchParams.has("course")).toBe(false);
      // Closing isn't a width: the next open is back at the saved width.
      expect(await stored(page, "panel-details-w")).not.toBe("360");
    });
  });

  it("double-click resets each divider to its default", async () => {
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      await dragBy(page, detailsDivider(page), -120);
      expect(Math.round(await panelWidth(page))).toBe(560);
      await detailsDivider(page).dblclick();
      await expect.poll(async () => Math.round(await panelWidth(page))).toBe(440);
      await page.getByRole("button", { name: "Close details" }).click();

      await dragBy(page, reqsDivider(page), 600 - (await asideWidth(page)));
      expect(Math.abs((await asideWidth(page)) - 600)).toBeLessThanOrEqual(1);
      await reqsDivider(page).dblclick();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(715);
      await expect.poll(() => stored(page, "panel-reqs-w")).toBeNull();
    });
  });

  it("the keyboard steps, jumps and toggles each divider", async () => {
    await onPage(planUrl(), async (page) => {
      const sep = reqsDivider(page);
      await sep.focus();
      expect(await sep.getAttribute("aria-valuemin")).toBe("48");
      expect(await sep.getAttribute("aria-valuemax")).toBe(String(1664 - 16 - 496));
      const steps: [string, string, string][] = [
        ["ArrowLeft", "699", "699 px"],
        ["Shift+ArrowLeft", "635", "635 px"],
        ["Home", "48", "Folded"],
        ["ArrowRight", "280", "One card column"],
        ["End", "1152", "1152 px"],
        ["Enter", "48", "Folded"],
        ["Enter", "1152", "1152 px"],
      ];
      for (const [key, now, text] of steps) {
        await page.keyboard.press(key);
        await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe(text);
        expect(await sep.getAttribute("aria-valuenow")).toBe(now);
        expect(await horizontalOverflow(page)).toBe(0);
      }
    });
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      const sep = detailsDivider(page);
      await sep.focus();
      const steps: [string, string, string][] = [
        ["ArrowLeft", "456", "456 px"],
        ["Shift+ArrowRight", "392", "392 px"],
        ["Home", "360", "360 px"],
        ["End", "960", "960 px"],
        ["Enter", "440", "Default width"],
        ["Enter", "760", "760 px"],
      ];
      for (const [key, now, text] of steps) {
        await page.keyboard.press(key);
        await expect.poll(() => sep.getAttribute("aria-valuetext")).toBe(text);
        expect(await sep.getAttribute("aria-valuenow")).toBe(now);
        expect(Math.round(await panelWidth(page))).toBe(Number(now));
      }
      expect(await sep.getAttribute("aria-valuemin")).toBe("360");
      expect(await sep.getAttribute("aria-valuemax")).toBe("960");
    });
  });

  it("widths survive a reload", async () => {
    await onPage(courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      await dragBy(page, reqsDivider(page), 600 - (await asideWidth(page)));
      await dragBy(page, detailsDivider(page), -80);
      await expect.poll(() => stored(page, "panel-details-w")).toBe("520");
      await page.reload({ waitUntil: "networkidle" });
      await detailsPanel(page).waitFor();
      expect(Math.abs((await asideWidth(page)) - 600)).toBeLessThanOrEqual(1);
      expect(Math.round(await panelWidth(page))).toBe(520);
    });
  });

  it.each([
    [1920, 1080],
    [1440, 900],
    [1280, 800],
  ])("no overflow at %i×%i with details closed, narrow or wide", async (width, height) => {
    for (const [url, storage] of [
      [planUrl(), {}],
      [courseUrl(), { "panel-details-w": "360" }],
      [courseUrl(), { "panel-details-w": "960" }],
    ] as const) {
      const page = await openPage(browser, url, { width, height }, { storage });
      try {
        if (url !== planUrl()) await detailsPanel(page).waitFor();
        expect(await horizontalOverflow(page), `${url} ${JSON.stringify(storage)}`).toBe(0);
        expect(await verticalOverflow(page), `${url} ${JSON.stringify(storage)}`).toBe(0);
      } finally {
        await page.close();
      }
    }
  });
});

describe("fold order and drawer", { timeout: 30_000 }, () => {
  const laptop = { width: 1280, height: 800 };
  const mid = { width: 1440, height: 900 };
  const tablet = { width: 900, height: 800 };
  const COLUMN_WIDTHS = [48, 280, 498, 715];
  const timelineWidth = async (page: Page) => {
    await settle(page);
    return page.evaluate(() => document.querySelector(".planner-timeline-area")!.getBoundingClientRect().width);
  };
  const onAt = async (viewport: { width: number; height: number }, url: string, check: (page: Page) => Promise<void>) => {
    const page = await openPage(browser, url, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  };
  const openFromCard = (page: Page, code: string) =>
    page.locator(`[data-placed="${code}"] button.course-card-title`).first().click();

  it("at 1280×800 with details closed, requirements have two columns", async () => {
    await onAt(laptop, planUrl(), async (page) => {
      expect(Math.round(await asideWidth(page))).toBe(498);
      expect(await tracks(page, '.available-courses[data-columns="3"]')).toBe(2);
    });
  });

  it("opening details steps requirements down by whole columns until they fold, and closing restores them", async () => {
    await onAt(mid, planUrl(), async (page) => {
      expect(Math.round(await asideWidth(page))).toBe(498);
      await openFromCard(page, "COMP2100");
      await detailsPanel(page).waitFor();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(48);
      expect(await timelineWidth(page)).toBeGreaterThanOrEqual(496);
      // Narrowing details gives the columns back one whole column at a time.
      await detailsDivider(page).focus();
      await page.keyboard.press("Home");
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(280);
      expect(COLUMN_WIDTHS).toContain(Math.round(await asideWidth(page)));
      expect(await timelineWidth(page)).toBeGreaterThanOrEqual(496);
      await page.getByRole("button", { name: "Close details" }).click();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(498);
    });
  });

  it("says when requirements fold to make room, in the toast and on the rail", async () => {
    await onAt(mid, planUrl(), async (page) => {
      await openFromCard(page, "COMP2100");
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.textContent()).toContain("Requirements folded to make room for course details");
      expect(await toast.getAttribute("role")).toBe("status");
      expect(await toast.getByRole("button").count()).toBe(0);
      const rail = page.getByRole("button", { name: /folded to make room for course details/ });
      expect(await rail.evaluate((el) => el.classList.contains("reqs-rail"))).toBe(true);
    });
  });

  it("doesn't announce a fold the page loaded with", async () => {
    await onAt(mid, `${planUrl()}?course=COMP2100`, async (page) => {
      await detailsPanel(page).waitFor();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(48);
      expect(await page.locator(".undo-toast").count()).toBe(0);
    });
  });

  it("rail recovery: unfolds at one column beside narrower details, or says why it can't", async () => {
    await onAt(mid, `${planUrl()}?course=COMP2100`, async (page) => {
      await detailsPanel(page).waitFor();
      await page.locator(".reqs-rail").click();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(280);
      await expect.poll(async () => Math.round(await panelWidth(page))).toBe(376);
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(true);
      expect(await detailsPanel(page).isVisible()).toBe(true);
      expect(await timelineWidth(page)).toBeGreaterThanOrEqual(496);
    });
    await onAt(laptop, `${planUrl()}?course=COMP2100`, async (page) => {
      await detailsPanel(page).waitFor();
      await expect.poll(async () => Math.round(await asideWidth(page))).toBe(48);
      await page.locator(".reqs-rail").click();
      await expect
        .poll(() => page.locator("p[aria-live]").textContent())
        .toBe("Not enough room for requirements and details together. Close details, or widen the window.");
      expect(Math.round(await asideWidth(page))).toBe(48);
    });
  });

  it("at mid widths details open as a drawer over the timeline, which stays usable", async () => {
    await onAt(tablet, `${planUrl()}?course=COMP2100`, async (page) => {
      const panel = detailsPanel(page);
      await panel.waitFor();
      await expect.poll(() => panel.getAttribute("data-mode")).toBe("drawer");
      expect(await detailsDivider(page).count()).toBe(0);
      const p = (await panel.boundingBox())!;
      const t = (await page.locator(".planner-timeline-area").boundingBox())!;
      expect(p.x).toBeLessThan(t.x + t.width);
      expect(p.x + p.width).toBeGreaterThanOrEqual(t.x + t.width - 1);
      // Over the panes, not the plan header above them.
      expect(await panel.evaluate((el) => el.parentElement!.classList.contains("planner-panes"))).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(t.y - 1);
      expect(await horizontalOverflow(page)).toBe(0);
      // A card to the left of the drawer still takes clicks.
      await openFromCard(page, "COMP1130");
      await expect.poll(() => panel.locator("h2").textContent()).toContain("COMP1130");
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("the two-column body follows the panel's own width", async () => {
    const at = async (width: string, keys: string[], columns: number) => {
      const page = await openPage(browser, courseUrl(), desktop, { storage: { "panel-details-w": width } });
      try {
        await detailsPanel(page).waitFor();
        await detailsDivider(page).focus();
        for (const key of keys) await page.keyboard.press(key);
        await expect.poll(async () => Math.round(await panelWidth(page))).toBe(columns === 1 ? 679 : 680);
        expect(await tracks(page, ".details-body")).toBe(columns);
        expect(await detailsPanel(page).evaluate((el) => el.className)).not.toMatch(/wide|two/);
      } finally {
        await page.close();
      }
    };
    await at("695", ["ArrowRight"], 1);
    await at("664", ["ArrowLeft"], 2);
  });

  it("motion: widths ease over 200ms, and not at all under reduced motion", async () => {
    const durations = (page: Page) =>
      page.evaluate(() => [".planner-panes", ".details-panel"].map((s) => getComputedStyle(document.querySelector(s)!).transitionDuration));
    await onAt(desktop, courseUrl(), async (page) => {
      await detailsPanel(page).waitFor();
      expect(await durations(page)).toEqual(["0.2s", "0.2s"]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await durations(page)).toEqual(["0s", "0s"]);
    });
  });

  it("passes axe docked at 1280×800", async () => {
    await onAt(laptop, `${planUrl()}?course=COMP2100`, async (page) => {
      await detailsPanel(page).waitFor();
      await expect.poll(() => detailsPanel(page).getAttribute("data-mode")).toBe("docked");
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});
