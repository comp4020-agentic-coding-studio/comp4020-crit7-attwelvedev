import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow, type Viewport } from "../browser";
import { baseUrl, browser, openSearch, planUrl, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

describe("two-semester labels", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const range = /^S[12] \d{4} – S[12] \d{4}$/;
  // The located course's flashing parts, by code: part 1 and its stub.
  const highlighted = (page: Page) =>
    page
      .locator(".course-card-highlighted")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-placed") ?? el.getAttribute("data-part-two")));

  it("search's Place in… lists ranges for a two-semester course", async () => {
    const created = await fetch(new URL("/api/plans", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      redirect: "manual",
    });
    const id = created.headers.get("location")!.split("/").pop()!;
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openSearch(page);
      await page.fill(".course-search input", "COMP4550");
      await page.click(".course-search button[type=submit]");
      const card = page.locator(".course-search .course-card").filter({ hasText: "COMP4550" });
      await card.getByRole("button", { name: "Place in…" }).click();
      const items = page.getByRole("menu", { name: "Place COMP4550 in" }).getByRole("menuitem");
      await items.first().waitFor();
      const texts = await items.allInnerTexts();
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) expect(text).toMatch(range);
      // The list is as narrow as its toggle, so a range must not wrap.
      const lines = await items.evaluateAll((buttons) =>
        buttons.map((button) => {
          const text = document.createRange();
          text.selectNodeContents(button);
          return new Set([...text.getClientRects()].map((rect) => Math.round(rect.top))).size;
        }),
      );
      expect(lines, JSON.stringify(lines)).toEqual(lines.map(() => 1));
    } finally {
      await page.close();
    }
  });

  it("Move to lists ranges for a placed two-semester course", async () => {
    const id = await planWithPlacement("COMP4550", 4);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      // Term 4 starts off-screen, and any scroll closes the menu, so bring
      // the card into view before opening it rather than letting click scroll.
      const card = page.locator('[data-placed="COMP4550"]');
      await card.scrollIntoViewIfNeeded();
      await card.getByRole("button", { name: "More options for COMP4550" }).click();
      const buttons = page.getByRole("list", { name: "Move COMP4550 to" }).getByRole("button");
      await buttons.first().waitFor();
      const texts = await buttons.allInnerTexts();
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) expect(text).toMatch(range);
    } finally {
      await page.close();
    }
  });

  it("search's placed row shows the straddle and locates part 1", async () => {
    const id = await planWithPlacement("COMP4550", 4);
    const cutoff = await fetch(new URL(`/api/plans/${id}/cutoff`, baseUrl), {
      method: "PUT",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ cutoff: 5 }),
    });
    expect(cutoff.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openSearch(page);
      await page.fill(".course-search input", "COMP4550");
      await page.click(".course-search button[type=submit]");
      const row = page.locator(".course-search .placed-row").filter({ hasText: "COMP4550" });
      await row.waitFor();
      expect(await row.locator(".placed-row-status").innerText()).toBe("Completed S1 2029 · planned S2 2029");
      const locate = row.getByRole("button", {
        name: /^COMP4550 part 1 is completed in S1 2029 — locate it on the timeline$/,
      });
      expect(await locate.count()).toBe(1);
      await locate.click();
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-placed"))).toBe("COMP4550");
    } finally {
      await page.close();
    }
  });

  it("a placed row's part 2 button locates the stub", async () => {
    const id = await planWithPlacement("COMP4550", 4);
    const cutoff = await fetch(new URL(`/api/plans/${id}/cutoff`, baseUrl), {
      method: "PUT",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ cutoff: 5 }),
    });
    expect(cutoff.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openSearch(page);
      await page.fill(".course-search input", "COMP4550");
      await page.click(".course-search button[type=submit]");
      const row = page.locator(".course-search .placed-row").filter({ hasText: "COMP4550" });
      await row
        .getByRole("button", { name: /^COMP4550 part 2 is planned for S2 2029 — locate it on the timeline$/ })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.closest("[data-part-two]")?.getAttribute("data-part-two")),
        )
        .toBe("COMP4550");
      await expect.poll(() => highlighted(page)).toEqual(["COMP4550", "COMP4550"]);
    } finally {
      await page.close();
    }
  });

  it("marks part 1 on the example plan's COMP4550 card", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator('[data-placed="COMP4550"] .course-card-part').innerText()).toBe(
        "Part 1 of 2 · continues in S2 2030",
      );
      expect(await page.locator('[data-placed="COMP1130"] .course-card-part').count()).toBe(0);
    });
  });

  // The 13rem card leaves the marker just short of room, and a term label
  // must never break inside itself ("S2 / 2030").
  it.each([
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ])("keeps the marker's term label on one line at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      const term = page.locator('[data-placed="COMP4550"] .course-card-part-term');
      expect(await term.innerText()).toBe("S2 2030");
      const lines = await term.evaluate((el) => {
        const text = document.createRange();
        text.selectNodeContents(el);
        return new Set([...text.getClientRects()].map((rect) => Math.round(rect.top))).size;
      });
      expect(lines).toBe(1);
    });
  });

  it.each([
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ])("shows part 2 of the example's COMP4550 in the next term at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      const stub = page.locator('[data-term="7"] [data-part-two="COMP4550"]');
      expect(await stub.count()).toBe(1);
      expect(await stub.evaluate((el) => el.classList.contains("course-card"))).toBe(false);
      expect(await stub.locator("button").count()).toBe(1);
      expect(
        await stub
          .getByRole("button", { name: /^COMP4550 part 1 is planned for S1 2030 — locate it on the timeline$/ })
          .count(),
      ).toBe(1);
      expect(await stub.getAttribute("data-family")).toBe(
        await page.locator('[data-placed="COMP4550"]').getAttribute("data-family"),
      );
    });
  });

  it.each([
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ])("shows each part's own units on the timeline at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      for (const selector of ['[data-placed="COMP4550"]', '[data-part-two="COMP4550"]']) {
        const units = page.locator(selector).locator(".course-card-unit-count");
        expect(await units.locator('[aria-hidden="true"]').textContent()).toBe("12u");
        expect(await units.locator(".visually-hidden").textContent()).toBe("12 units");
      }
      const stub = page.locator('[data-part-two="COMP4550"]');
      expect(await stub.locator(".course-card-code").textContent()).toBe("COMP4550");
      expect(await stub.locator(".course-card-part").innerText()).toBe("Part 2 of 2 · continued from S1 2030");
      const lines = await stub.locator(".course-card-part-term").evaluate((el) => {
        const text = document.createRange();
        text.selectNodeContents(el);
        return new Set([...text.getClientRects()].map((rect) => Math.round(rect.top))).size;
      });
      expect(lines).toBe(1);
      const { scrollWidth, clientWidth } = await stub.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  });

  it("keeps whole-course units on a search card", async () => {
    const created = await fetch(new URL("/api/plans", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      redirect: "manual",
    });
    const id = created.headers.get("location")!.split("/").pop()!;
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openSearch(page);
      await page.fill(".course-search input", "COMP4550");
      await page.click(".course-search button[type=submit]");
      const card = page.locator(".course-search .course-card").filter({ hasText: "COMP4550" });
      expect(await card.locator('.course-card-unit-count [aria-hidden="true"]').textContent()).toBe("12+12u");
    } finally {
      await page.close();
    }
  });

  it("the part 2 stub locates part 1 and both flash", async () => {
    await withPlan(desktop, async (page) => {
      await page.locator('[data-part-two="COMP4550"] button').click();
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-placed"))).toBe("COMP4550");
      await expect.poll(() => highlighted(page)).toEqual(["COMP4550", "COMP4550"]);
    });
  });

  it.each([
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ])("part 1's marker term locates the part 2 stub at $width×$height", async (viewport) => {
    await withPlan(viewport, async (page) => {
      await page
        .locator('[data-placed="COMP4550"]')
        .getByRole("button", { name: /^COMP4550 part 2 is planned for S2 2030 — locate it on the timeline$/ })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.closest("[data-part-two]")?.getAttribute("data-part-two")),
        )
        .toBe("COMP4550");
      await expect.poll(() => highlighted(page)).toEqual(["COMP4550", "COMP4550"]);
    });
  });

  it("part 2 recedes with part 1", async () => {
    await withPlan(desktop, async (page) => {
      // On the example plan COMP4550 counts toward cap-research, not compulsory.
      await page.locator(`[data-group="compulsory"] > h2 .section-toggle`).hover();
      await expect.poll(() => page.locator('[data-placed="COMP4550"].course-card-receded').count()).toBe(1);
      await expect.poll(() => page.locator('[data-part-two="COMP4550"].part-two-stub-receded').count()).toBe(1);
    });
  });

  it("draws COMP4550's arrow to COMP4620 from its part 2 stub", async () => {
    const id = await planWithPlacement("COMP4550", 4);
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP4620", term: 7 }),
    });
    expect(placed.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await page.getByRole("button", { name: "More options", exact: true }).click();
      await page.getByLabel("Show prerequisite links").check();
      await page.keyboard.press("Escape");
      const line = page.locator('line[data-from="COMP4550"][data-to="COMP4620"]');
      await line.waitFor({ state: "attached" });
      const { point, stub } = await line.evaluate((el) => {
        const svg = el.closest("svg")!.getBoundingClientRect();
        const stub = document.querySelector('[data-part-two="COMP4550"]')!.getBoundingClientRect();
        const x = svg.left + Number(el.getAttribute("x1"));
        const y = svg.top + Number(el.getAttribute("y1"));
        return { point: { x, y }, stub: { left: stub.left, right: stub.right, top: stub.top, bottom: stub.bottom } };
      });
      expect(point.x).toBeGreaterThanOrEqual(stub.left);
      expect(point.x).toBeLessThanOrEqual(stub.right);
      expect(point.y).toBeGreaterThanOrEqual(stub.top);
      expect(point.y).toBeLessThanOrEqual(stub.bottom);
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
      await openSearch(page);
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
      await openSearch(page);
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
      await openSearch(page);
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

      // A requirement card, so the drag starts on the phone's Requirements tab.
      await page.getByRole("navigation", { name: "Plan view" }).getByRole("button", { name: "Requirements" }).click();
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

  // COMP4550 is hard-blocked only from terms 0, 1 and 7, so term 2 is open.
  it("outlines both terms under a touch drag of a two-semester course", async () => {
    const id = await planWithPlacement("COMP4550", 4);
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

      const card = page.locator('[data-drag-code="COMP4550"]').first();
      await card.scrollIntoViewIfNeeded();
      const [cx, cy] = await centre('[data-drag-code="COMP4550"]');
      await touch("touchStart", cx, cy);
      await page.waitForTimeout(450); // past touch-drag.ts's HOLD_MS
      await expect.poll(() => page.locator(".drag-ghost").count()).toBe(1);

      // Narrow timeline: bring term 2 on-screen mid-drag.
      await page.locator('[data-term="2"]').evaluate((el) => el.scrollIntoView({ inline: "center" }));
      const [ox, oy] = await centre('[data-term="2"]');
      await touch("touchMove", ox, oy);
      await touch("touchMove", ox + 4, oy + 4);
      await expect
        .poll(async () => [await outlined(page, 2), await outlined(page, 3), await outlined(page, 4)])
        .toEqual([true, true, false]);
      await touch("touchEnd");
    } finally {
      await context.close();
    }
  });

  // The ghost once lost to .course-card's position: relative, so it sat in
  // the flow at the end of <body>: off-screen, and making the page taller.
  it("floats the touch-drag ghost under the finger without growing the page", async () => {
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
      const height = () => page.evaluate(() => document.documentElement.scrollHeight);
      const before = await height();
      const box = (await page.locator('[data-drag-code="COMP1130"]').boundingBox())!;
      const [x, y] = [box.x + box.width / 2, box.y + 20];
      await touch("touchStart", x, y);
      await page.waitForTimeout(450); // past touch-drag.ts's HOLD_MS
      await touch("touchMove", x + 30, y + 30);
      const ghost = page.locator(".drag-ghost");
      await expect.poll(() => ghost.count()).toBe(1);
      expect(await ghost.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
      // The clone is an <li> outside its list, which would give it a bullet.
      expect(await ghost.evaluate((el) => getComputedStyle(el).listStyleType)).toBe("none");
      const g = (await ghost.boundingBox())!;
      // touch-drag.ts puts the ghost's corner 14px below-right of the finger.
      expect(Math.abs(g.x - (x + 30 + 14))).toBeLessThanOrEqual(2);
      expect(Math.abs(g.y - (y + 30 + 14))).toBeLessThanOrEqual(2);
      expect(await height()).toBe(before);
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
        "Nothing on the timeline counts as completed yet. Each completed semester says so beside its heading.",
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

  it("Help describes the new controls by name", async () => {
    const page = await openPage(browser, new URL("/help/", baseUrl).href, desktop);
    try {
      const text = await page.evaluate(() => document.body.innerText);
      for (const name of [
        "Completed through",
        "More options",
        "Place in…",
        "Counts toward",
        "Verify on P&C",
        "Completed",
        "Planned",
        "When it runs",
        "Met",
        "Not sure",
        "⌘K",
        "Search courses",
        "double-click",
        "fold",
        "Timeline",
        "Requirements",
        "Programs & Courses",
        "Undo",
        "Redo",
        "⌘Z",
        "Ctrl+Y",
      ]) {
        expect(text).toContain(name);
      }
      expect(text).toMatch(/colou?r/i);
      // The chevrons and the card's own "Move to…" button are gone.
      // The gold cutoff line went in workspace-redesign Task 15 (user ruling,
      // 2026-09-29): each completed semester's heading says so instead.
      // The Details dialog, its "Your checks" list and its "Pin to" option
      // became the details sidebar (workspace-redesign Task 22).
      for (const gone of [
        "One more semester completed",
        "One fewer semester completed",
        "‹",
        "Move to…",
        "gold line",
        "Your checks",
        "Details dialog",
        "Pin to",
      ]) {
        expect(text).not.toContain(gone);
      }
    } finally {
      await page.close();
    }
  });

  it("Help has a section for each new area", async () => {
    const page = await openPage(browser, new URL("/help/", baseUrl).href, desktop);
    try {
      const headings = await page.evaluate(() =>
        [...document.querySelectorAll("h2")].map((h2) => h2.textContent?.trim()),
      );
      for (const heading of ["Course details", "Arranging the workspace", "On a phone"]) {
        expect(headings).toContain(heading);
      }
    } finally {
      await page.close();
    }
  });

  it("explains courses that run over two semesters", async () => {
    const page = await openPage(browser, new URL("/help/", baseUrl).href, desktop);
    try {
      const paragraph = await page.evaluate(() => {
        const heading = [...document.querySelectorAll("h2")].find(
          (h2) => h2.textContent?.trim() === "Courses that run over two semesters",
        );
        const next = heading?.nextElementSibling;
        return next?.tagName === "P" ? next.textContent : null;
      });
      expect(paragraph).not.toBeNull();
      for (const phrase of ["Part 1 of 2", "Part 2 of 2", "S1 2028 – S2 2028", "Completed S1 2028 · planned S2 2028"]) {
        expect(paragraph).toContain(phrase);
      }
    } finally {
      await page.close();
    }
  });
});

describe("completed terms", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  it("label the example's completed terms and only those", async () => {
    await withPlan(desktop, async (page) => {
      const labels = page.locator(".term-completed");
      expect(await labels.count()).toBe(2);
      for (const term of ["0", "1"]) {
        expect(await page.locator(`[data-term="${term}"] .term-completed`).textContent()).toBe("Completed");
      }
      expect(await page.locator('[data-term="2"] .term-completed').count()).toBe(0);
    });
  });

  it("abbreviate the unit count like the cards do", async () => {
    await withPlan(desktop, async (page) => {
      const units = page.locator('[data-term="0"] .term-units');
      expect(await units.locator('[aria-hidden="true"]').textContent()).toMatch(/^24\/24u$/);
      expect(await units.locator(".visually-hidden").textContent()).toBe("24 of 24 units");
    });
  });

  it("keep the header's height", async () => {
    await withPlan(desktop, async (page) => {
      const headerHeight = (term: string) =>
        page.evaluate((term) => {
          const column = document.querySelector(`[data-term="${term}"]`)!;
          const card = column.querySelector(".term-cards .course-card")!;
          return card.getBoundingClientRect().top - column.querySelector("h2")!.getBoundingClientRect().top;
        }, term);
      expect(Math.abs((await headerHeight("0")) - (await headerHeight("2")))).toBeLessThanOrEqual(2);
    });
  });

  it("follow the completed semesters as they change", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const labels = page.locator(".term-completed");
      expect(await labels.count()).toBe(0);
      await page.locator(".completed-toggle").click();
      await page.locator(".completed-panel").getByRole("button", { name: "S1 2027" }).click();
      await expect.poll(() => labels.count()).toBe(1);
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
          const scroller = document.querySelector(".timeline-scroll")!;
          scroller.scrollTop = scroller.scrollHeight;
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
