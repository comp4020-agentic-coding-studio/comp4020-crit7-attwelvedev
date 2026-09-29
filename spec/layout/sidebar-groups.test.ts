import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { baseUrl, browser, detailsPanel, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

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

describe("linked highlighting", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  // COMP2100 counts toward the compulsory group; COMP1140 (S2 2027) is its
  // prerequisite and COMP2120 (S2 2028) needs it.
  const home = (page: Page) => page.locator('[data-group="compulsory"]');
  const card = (page: Page, code: string) => page.locator(`[data-placed="${code}"]`);

  async function openCOMP2100(page: Page) {
    await card(page, "COMP2100").locator(".course-card-title").click();
    await detailsPanel(page).waitFor();
  }

  it("marks the open course's group, prerequisites, dependents and card, and clears them on close", async () => {
    await withPlan(desktop, async (page) => {
      await openCOMP2100(page);
      expect(await home(page).getAttribute("class")).toContain("group-linked");
      expect(await home(page).textContent()).toContain("COMP2100 counts here");
      expect(await page.locator('[data-group="electives"]').textContent()).toContain("COMP2100 could count here");
      expect(await card(page, "COMP1140").textContent()).toContain("Prerequisite of COMP2100");
      expect(await card(page, "COMP2120").textContent()).toContain("Needs COMP2100");
      expect(await card(page, "COMP2100").getAttribute("class")).toContain("course-card-selected");

      await detailsPanel(page).getByRole("button", { name: "Close details" }).click();
      await expect.poll(() => detailsPanel(page).count()).toBe(0);
      expect(await page.locator(".group-linked, .course-card-selected, .group-tag, .badge-linked").count()).toBe(0);
    });
  });

  it("tints the home group in its family colour", async () => {
    await withPlan(desktop, async (page) => {
      const before = await home(page).evaluate((el) => getComputedStyle(el).backgroundColor);
      await openCOMP2100(page);
      const after = await home(page).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(after).not.toBe(before);
      expect(await card(page, "COMP2100").evaluate((el) => getComputedStyle(el).boxShadow)).toContain("2px");
    });
  });

  it("keeps drawing the prerequisite links overlay while a course is open", async () => {
    await withPlan(desktop, async (page) => {
      // Links first: the open sidebar sits over the plan header's controls.
      await page.getByRole("button", { name: "More options", exact: true }).click();
      await page.getByLabel("Show prerequisite links").check();
      await page.keyboard.press("Escape");
      await openCOMP2100(page);
      await page.locator(".badge-linked").first().waitFor({ state: "attached" });
      expect(await page.locator(".prereq-overlay line").count()).toBeGreaterThan(0);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("is axe clean at %i×%i with a course open and its chips showing", async (width, height) => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, { width, height });
    try {
      await page.locator(".badge-linked").first().waitFor({ state: "attached" });
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
