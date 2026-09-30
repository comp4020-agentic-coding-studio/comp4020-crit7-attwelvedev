import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, type Viewport } from "../browser";
import { baseUrl, browser, planWithPlacement, settle, useBrowser } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };
const phone = { width: 390, height: 844 };

const specPanel = (page: Page) => page.locator('aside[aria-label="Specialisation details"]');
const example = (code: string) => new URL(`/plan/example?spec=${code}`, baseUrl).href;
const editable = async (code: string, chosen?: string) => {
  const id = await planWithPlacement("COMP3670", 5);
  if (chosen) {
    const res = await fetch(new URL(`/api/plans/${id}/choices`, baseUrl), {
      method: "PUT",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ groupId: "spec", childId: chosen }),
    });
    expect(res.status).toBe(200);
  }
  return new URL(`/plan/${id}?spec=${code}`, baseUrl).href;
};

const whatIfRoute = "**/api/plans/*/what-if*";
const fitShown = (page: Page) => specPanel(page).getByRole("progressbar", { name: "If you chose this" }).waitFor();

interface State {
  name: string;
  url: () => Promise<string>;
  // Routes in place before the page loads (the panel asks on mount); the
  // returned function releases anything held, before the page closes.
  route?: (page: Page) => Promise<() => void>;
  ready: (page: Page) => Promise<void>;
}

const STATES: Record<string, State> = {
  A: { name: "A. chosen", url: async () => example("ARIN-SPEC"), ready: async () => {} },
  B: { name: "B. unchosen, read-only", url: async () => example("SYAR-SPEC"), ready: fitShown },
  C: { name: "C. none chosen, editable", url: () => editable("ARIN-SPEC"), ready: fitShown },
  D: { name: "D. switch, editable", url: () => editable("HCCC-SPEC", "arin"), ready: fitShown },
  E: {
    name: "E. what-if loading",
    url: async () => example("SYAR-SPEC"),
    // Held until the checks are done, rather than for a fixed 3s, so the
    // loading line is what they see however long axe takes.
    route: async (page) => {
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(whatIfRoute, async (route) => {
        await held;
        await route.continue().catch(() => {});
      });
      return release;
    },
    ready: (page) => specPanel(page).getByText("Working out how this would fit your plan…").waitFor(),
  },
  F: {
    name: "F. what-if error",
    url: async () => example("SYAR-SPEC"),
    route: async (page) => {
      await page.route(whatIfRoute, (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
      return () => {};
    },
    ready: (page) => specPanel(page).getByText("Couldn't work out how this fits your plan.").waitFor(),
  },
  G: { name: "G. HCCC", url: async () => example("HCCC-SPEC"), ready: fitShown },
};

interface View {
  name: string;
  viewport: Viewport;
  reach: (page: Page) => Promise<void>;
}

const VIEWS: Record<string, View> = {
  narrow: {
    name: "1920 narrow docked",
    viewport: desktop,
    reach: async (page) => {
      await expect.poll(() => specPanel(page).getAttribute("data-mode")).toBe("docked");
      await settle(page);
    },
  },
  wide: {
    name: "1920 wide docked",
    viewport: desktop,
    reach: async (page) => {
      await expect.poll(() => specPanel(page).getAttribute("data-mode")).toBe("docked");
      await specPanel(page).getByRole("button", { name: "Widen details" }).click();
      await expect.poll(async () => Math.round((await specPanel(page).boundingBox())!.width)).toBe(760);
      await settle(page);
    },
  },
  phone: {
    name: "390 sheet",
    viewport: phone,
    reach: async (page) => {
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("half");
      await settle(page);
    },
  },
};

// Opens `state` at `view`, ready to check, and always closes the page.
async function at(state: State, view: View, check: (page: Page) => Promise<void>) {
  const url = await state.url();
  const page = await openPage(browser, state.route ? new URL("/plan/example", baseUrl).href : url, view.viewport);
  let release = () => {};
  try {
    if (state.route) {
      release = await state.route(page);
      await page.goto(url, { waitUntil: "domcontentloaded" });
    }
    await specPanel(page).locator("h2").waitFor();
    await state.ready(page);
    await view.reach(page);
    await check(page);
  } finally {
    release();
    await page.close();
  }
}

const CASES = Object.values(STATES).flatMap((state) => Object.values(VIEWS).map((view) => ({ state, view })));

// Every state the specialisation panel can be in, at every width it's
// drawn at (Phase 05 §4.2), each checked the same way.
describe("specialisation states", { timeout: 30_000 }, () => {
  it.each(CASES.map((c) => ({ ...c, label: `${c.state.name} at ${c.view.name}` })))(
    "$label: axe clean, no sideways overflow",
    async ({ state, view }) => {
      await at(state, view, async (page) => {
        expect(await axeViolations(page)).toEqual([]);
        expect(await horizontalOverflow(page)).toBe(0);
      });
    },
  );

  it.each([STATES.A, STATES.C])("$name, wide: the body is two columns side by side, neither ruled above", async (state) => {
    await at(state, VIEWS.wide, async (page) => {
      const columns = await specPanel(page)
        .locator(".details-body > .details-column")
        .evaluateAll((els) =>
          els.map((el) => {
            const box = el.getBoundingClientRect();
            const first = el.querySelector(":scope > .details-section");
            return { top: box.top, left: box.left, right: box.right, rule: first && getComputedStyle(first).borderTopWidth };
          }),
        );
      expect(columns).toHaveLength(2);
      const [first, second] = columns;
      expect(Math.abs(first.top - second.top)).toBeLessThanOrEqual(1);
      expect(second.left).toBeGreaterThan(first.right);
      expect([first.rule, second.rule]).toEqual(["0px", "0px"]);
    });
  });

  it("C, phone: Choose clears the tab bar at half, and the P&C link is reachable at full", async () => {
    await at(STATES.C, VIEWS.phone, async (page) => {
      const choose = specPanel(page).getByRole("button", { name: "Choose this specialisation" });
      const chooseBottom = (await choose.boundingBox())!;
      const tabbarTop = (await page.locator("nav.tabbar").boundingBox())!.y;
      expect(chooseBottom.y + chooseBottom.height).toBeLessThanOrEqual(tabbarTop);

      await specPanel(page).getByRole("slider", { name: "Resize details" }).click();
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("full");
      await settle(page);
      const link = specPanel(page).locator(".details-footer a");
      await link.scrollIntoViewIfNeeded();
      expect(
        await link.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit !== null && el.contains(hit);
        }),
      ).toBe(true);
    });
  });

  it("A, phone: the progress jump shows Requirements and drops the sheet to peek", async () => {
    await at(STATES.A, VIEWS.phone, async (page) => {
      await specPanel(page).getByRole("button", { name: "See your progress in Requirements" }).click();
      await expect
        .poll(() =>
          page.getByRole("navigation", { name: "Plan view" }).getByRole("button", { name: "Requirements", exact: true }).getAttribute("aria-pressed"),
        )
        .toBe("true");
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("peek");
    });
  });

  it.each([STATES.B, STATES.E])("$name, phone: the peek is the header alone", async (state) => {
    await at(state, VIEWS.phone, async (page) => {
      await specPanel(page).getByRole("slider", { name: "Resize details" }).press("Home");
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("peek");
      await settle(page);
      expect(await specPanel(page).locator(".details-body").getAttribute("hidden")).not.toBeNull();
      expect(await specPanel(page).locator(".details-head h2").isVisible()).toBe(true);
    });
  });
});
