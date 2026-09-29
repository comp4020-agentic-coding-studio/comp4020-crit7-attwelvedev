import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { openPage, type Viewport } from "../browser";
import { baseUrl, browser, detailsPanel, planWithPlacement, useBrowser } from "./helpers";

useBrowser();

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

describe("undo for every plan change", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const toast = (page: Page) => page.locator(".undo-toast");

  async function withFreshPlan(check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("a move from the card menu offers Undo, which moves it back", async () => {
    await withFreshPlan(async (page) => {
      await page.locator('[data-placed="COMP1130"]').getByRole("button", { name: "More options for COMP1130" }).click();
      await page.locator('[data-placed="COMP1130"] .card-menu-terms').getByRole("button", { name: "S1 2028" }).click();
      await expect.poll(() => page.locator('[data-term="2"] [data-placed="COMP1130"]').count()).toBe(1);
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Moved COMP1130 to S1 2028.");
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => page.locator('[data-term="0"] [data-placed="COMP1130"]').count()).toBe(1);
      expect(await toast(page).count()).toBe(0);
    });
  });

  it("Place in… offers Undo, which removes it again", async () => {
    await withFreshPlan(async (page) => {
      const card = page.locator(".available-courses .course-card").filter({ hasText: "COMP1100" }).first();
      await card.getByRole("button", { name: "Place in…" }).click();
      await page.getByRole("menu", { name: "Place COMP1100 in" }).getByRole("menuitem").first().click();
      await expect.poll(() => page.locator('[data-placed="COMP1100"]').count()).toBe(1);
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Placed COMP1100 in");
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => page.locator('[data-placed="COMP1100"]').count()).toBe(0);
    });
  });

  // Removes COMP1130 from its card menu, with the page's timers faked so
  // the 8-second timeout can be stepped through.
  async function removeWithFakeClock(page: Page) {
    await page.clock.install();
    await page.locator('[data-placed="COMP1130"]').getByRole("button", { name: "More options for COMP1130" }).click();
    await page.locator('[data-placed="COMP1130"] .course-card-menu').getByRole("button", { name: "Remove" }).click();
    await expect.poll(() => toast(page).count()).toBe(1);
  }

  it("the toast stays while the pointer is over it, then times out once it leaves", async () => {
    await withFreshPlan(async (page) => {
      await removeWithFakeClock(page);
      await toast(page).hover();
      await page.clock.runFor(20_000);
      expect(await toast(page).count()).toBe(1);
      await page.mouse.move(5, 5);
      await page.clock.runFor(7_000);
      expect(await toast(page).count()).toBe(1);
      await page.clock.runFor(2_000);
      expect(await toast(page).count()).toBe(0);
    });
  });

  it("the toast stays while its Undo has keyboard focus", async () => {
    await withFreshPlan(async (page) => {
      await removeWithFakeClock(page);
      await page.mouse.move(5, 5);
      await toast(page).getByRole("button", { name: "Undo" }).focus();
      await page.clock.runFor(20_000);
      expect(await toast(page).count()).toBe(1);
      await page.locator("h1").click();
      await page.clock.runFor(9_000);
      expect(await toast(page).count()).toBe(0);
    });
  });

  it("dropping a course back on its own semester changes nothing and offers no Undo", async () => {
    await withFreshPlan(async (page) => {
      const card = page.locator('[data-term="0"] [data-placed="COMP1130"]');
      const term = (await page.locator('[data-term="0"]').boundingBox())!;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(term.x + term.width / 2, term.y + term.height - 40, { steps: 10 });
      await page.mouse.up();
      // Long enough for a toast to have arrived if the drop sent a request.
      await page.waitForTimeout(1000);
      expect(await toast(page).count()).toBe(0);
      expect(await card.count()).toBe(1);
    });
  });

  it("a move from the details strip offers Undo", async () => {
    await withFreshPlan(async (page) => {
      await page.locator('[data-placed="COMP1130"] .course-card-title').click();
      await detailsPanel(page).getByRole("button", { name: "Move to S1 2028" }).click();
      await expect.poll(() => page.locator('[data-term="2"] [data-placed="COMP1130"]').count()).toBe(1);
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Moved COMP1130 to S1 2028.");
    });
  });
});

describe("knock-on warning", { timeout: 30_000 }, () => {
  it("says when a change leaves another course missing a prerequisite", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP2120", term: 3 }),
    });
    expect(placed.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      const card = page.locator('[data-placed="COMP2100"]');
      await card.getByRole("button", { name: "More options for COMP2100" }).click();
      await card.locator(".card-menu-terms").getByRole("button", { name: "S1 2029" }).click();
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      expect(await toast.textContent()).toContain("Moved COMP2100 to S1 2029. COMP2120 now misses a prerequisite.");
    } finally {
      await page.close();
    }
  });

  it("shows over the details panel on a phone, where the panel covers the screen", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP2120", term: 3 }),
    });
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, { width: 390, height: 844 });
    try {
      await detailsPanel(page).getByRole("button", { name: "Move to S1 2029" }).click();
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      const onTop = await toast.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      expect(onTop).toBe(true);
      // The warning is the end of the sentence: it wraps, never cut off.
      const text = toast.locator("span");
      expect(await text.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await text.textContent()).toContain("now misses a prerequisite");
      // As wide as the phone allows (390 less 1rem a side), not half of it.
      expect((await toast.boundingBox())!.width).toBeGreaterThan(300);
    } finally {
      await page.close();
    }
  });
});
