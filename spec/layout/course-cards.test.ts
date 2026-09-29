import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, type Viewport } from "../browser";
import { baseUrl, browser, detailsPanel, expectDetailsOpenThenClose, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

describe("course cards", { timeout: 30_000 }, () => {
  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i no two of a card's buttons touch", async (width, height) => {
    // Measured from the render, not the markup: loose inline buttons pass
    // any markup check yet sit flush against each other on screen.
    const { measured, tight } = await withPlan({ width, height }, (page) =>
      page.$$eval(".course-card", (cards) => {
        let measured = 0;
        const tight: string[] = [];
        for (const card of cards) {
          const rects = Array.from(card.querySelectorAll("button"))
            .filter((b) => b.getClientRects().length > 0)
            .map((b) => ({ label: b.textContent?.trim(), rect: b.getBoundingClientRect() }));
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i].rect;
              const b = rects[j].rect;
              const space = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
              measured++;
              if (space < 4) tight.push(`${card.querySelector("strong")?.textContent} ${rects[i].label}/${rects[j].label}: ${space.toFixed(1)}px`);
            }
          }
        }
        return { measured, tight };
      }),
    );
    expect(measured).toBeGreaterThan(0);
    expect(tight).toEqual([]);
  });

  it("a placed course's term button keeps its border on hover", async () => {
    // Guards a cascade slip: a later same-specificity rule gave this button
    // a border its own :hover rule then took away.
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const button = page.locator(".placed-row .course-card-term-link").first();
      const border = () => button.evaluate((el) => getComputedStyle(el).borderTopWidth);
      const atRest = await border();
      await button.hover();
      expect(atRest).not.toBe("0px");
      expect(await border()).toBe(atRest);
    });
  });

  it("a blocked card recedes without fading its controls", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width: 1920, height: 1080 });
    try {
      // The server refuses a hard-blocked placement and a fresh plan has no
      // blocked sidebar card, so give a rendered card the class: this is
      // about the CSS rule, not how the state arises.
      const cards = page.locator(".course-card-unplaced");
      expect(await cards.count()).toBeGreaterThan(1);
      await cards.first().evaluate((el) => el.classList.replace("course-card-unplaced", "course-card-hard"));
      const card = page.locator(".course-card-hard").first();
      expect(await card.locator("button").count()).toBeGreaterThan(0);
      // Opacity compounds down the tree and a child can't undo it.
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
      const codeColour = (locator: typeof card) =>
        locator.locator(".course-card-code").first().evaluate((el) => getComputedStyle(el).color);
      expect(await codeColour(card)).not.toBe(await codeColour(page.locator(".course-card-unplaced").first()));
      expect(await card.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
    } finally {
      await page.close();
    }
  });

  it("a placed row recedes without fading its buttons", async () => {
    await withPlan({ width: 1920, height: 1080 }, async (page) => {
      const card = page.locator(".placed-row").first();
      // Opacity compounds down the tree and a child can't undo it, so walk
      // every ancestor of each button, not just the button itself.
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
      const titleColour = (selector: string) =>
        page.locator(`${selector} strong`).first().evaluate((el) => getComputedStyle(el).color);
      expect(await titleColour(".placed-row")).not.toBe(await titleColour(".course-card-unplaced"));
    });
  });
});

describe("placed rows", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  // The one group COMP1130 belongs to: its label is also the start of
  // COMP1130's own title, so match the section by its heading instead.
  const group = (page: Page) =>
    page.locator(".requirement-group").filter({ has: page.getByRole("heading", { name: "Programming as Problem Solving", exact: true }) });
  const row = (page: Page) => group(page).locator(".placed-rows .placed-row");

  it("lists a completed course as one row below its group's unplaced cards, not draggable", async () => {
    await withPlan(desktop, async (page) => {
      expect(await row(page).count()).toBe(1);
      expect(await row(page).locator(".placed-row-status").innerText()).toBe("Completed S1 2027");
      const cards = group(page).locator(".available-courses .course-card");
      expect(await cards.count()).toBeGreaterThan(0);
      const lastCard = (await cards.last().boundingBox())!;
      expect((await row(page).boundingBox())!.y).toBeGreaterThanOrEqual(lastCard.y + lastCard.height);
      expect(await row(page).getAttribute("draggable")).toBeNull();
    });
  });

  it("says a planned course is planned, and its term locates it on the timeline", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      expect(await row(page).locator(".placed-row-status").innerText()).toBe("Planned S1 2027");
      const locate = page.getByRole("button", { name: /^COMP1130 is planned for S1 2027/ });
      expect(await locate.count()).toBe(1);
      await locate.click();
      await expect
        .poll(() => page.locator('[data-placed="COMP1130"]').evaluate((el) => el.classList.contains("course-card-highlighted")))
        .toBe(true);
    } finally {
      await page.close();
    }
  });

  it("opens Details from the row's title", async () => {
    await withPlan(desktop, async (page) => {
      const title = row(page).locator(".placed-row-title");
      expect(await title.getAttribute("title")).toBe("Programming as Problem Solving (Advanced)");
      expect(await row(page).getByRole("button", { name: "Programming as Problem Solving (Advanced), details", exact: true }).count()).toBe(1);
      await title.click();
      await expectDetailsOpenThenClose(page, "COMP1130");
    });
  });

  it.each([
    ["wraps to two lines on a phone", phone, true],
    ["fits on one line in the wide sidebar", desktop, false],
  ])("%s", async (_name, viewport, twoLines) => {
    await withPlan(viewport, async (page) => {
      const target = row(page);
      await target.scrollIntoViewIfNeeded();
      const code = (await target.locator(".placed-row-code").boundingBox())!;
      const status = (await target.locator(".placed-row-status").boundingBox())!;
      if (twoLines) {
        expect(status.y).toBeGreaterThanOrEqual(code.y + code.height);
      } else {
        expect(Math.abs(status.y + status.height / 2 - (code.y + code.height / 2))).toBeLessThanOrEqual(4);
      }
      const title = await target.locator(".placed-row-title").evaluate((el) => ({
        overflows: el.scrollWidth > el.clientWidth,
        textOverflow: getComputedStyle(el).textOverflow,
      }));
      if (title.overflows) expect(title.textOverflow).toBe("ellipsis");
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("stays axe-clean", async () => {
    expect(await withPlan(desktop, axeViolations)).toEqual([]);
  });
});

describe("card header", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };

  async function withFreshPlan(viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i a timeline card leads with its code and units, and has no em-dash title", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      expect(await card.locator(".course-card-code").textContent()).toBe("COMP1130");
      const units = card.locator(".course-card-unit-count");
      expect(await units.locator('[aria-hidden="true"]').textContent()).toBe("6u");
      const spoken = units.locator(".visually-hidden");
      expect(await spoken.textContent()).toBe("6 units");
      expect(await spoken.evaluate((el) => getComputedStyle(el).width)).toBe("1px");

      const unitsBox = (await units.boundingBox())!;
      const headBox = (await card.locator(".course-card-head").boundingBox())!;
      expect(Math.abs(unitsBox.x + unitsBox.width - (headBox.x + headBox.width))).toBeLessThanOrEqual(1);

      // Every text node.
      const dashed = await card.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const found: string[] = [];
        let seen = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          seen++;
          if (node.textContent?.includes(" — ")) found.push(node.textContent);
        }
        return { seen, found };
      });
      expect(dashed.seen).toBeGreaterThan(0);
      expect(dashed.found).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  it("a timeline card's title is a button that opens its details", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      const title = card.getByRole("button", { name: "Programming as Problem Solving (Advanced), details" });
      expect(await title.count()).toBe(1);
      expect(await title.getAttribute("aria-expanded")).toBeNull();
      await title.click();
      await expectDetailsOpenThenClose(page, "COMP1130");
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i a sidebar card has a grip, no Details button, and a title that opens its details", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const card = page.locator(".course-card-unplaced").filter({ hasText: "COMP1100" });
      const grip = card.locator(".course-card-grip");
      expect(await grip.count()).toBe(1);
      expect(await grip.getAttribute("aria-hidden")).toBe("true");
      expect(await grip.getAttribute("tabindex")).toBeNull();
      expect(await card.getByRole("button", { name: "Details", exact: true }).count()).toBe(0);
      await card.locator(".course-card-title").click();
      await detailsPanel(page).waitFor();
      expect(await horizontalOverflow(page)).toBe(0);
      await expectDetailsOpenThenClose(page, "COMP1100");
    });
  });

  it("a drag from a sidebar card's grip places it", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('.course-card-unplaced[data-drag-code="COMP3630"]').first();
      await card.scrollIntoViewIfNeeded();
      const grip = card.locator(".course-card-grip");
      await grip.hover();
      await page.mouse.down();
      const start = (await grip.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 });
      const term = Number(await page.locator("[data-term]:not(.term-disallowed)").first().getAttribute("data-term"));
      const open = (await page.locator(`[data-term="${term}"]`).boundingBox())!;
      await page.mouse.move(open.x + open.width / 2, open.y + open.height / 2, { steps: 10 });
      await page.mouse.move(open.x + open.width / 2 + 4, open.y + open.height / 2 + 4, { steps: 2 });
      await page.mouse.up();
      await expect.poll(() => page.locator('[data-placed="COMP3630"]').count()).toBe(1);
    });
  });

  it("is clean under axe on a fresh plan and on the example", async () => {
    await withFreshPlan(desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
    expect(await withPlan(desktop, axeViolations)).toEqual([]);
  });
});

describe("course card menu", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const cardMenu = (page: Page, code: string) =>
    page.locator(`[data-placed="${code}"]`).getByRole("button", { name: `More options for ${code}` });

  async function withFreshPlan(viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("keeps Move to, Details and Remove out of sight, behind a toggle with its own panel", async () => {
    const id = await planWithPlacement("COMP1130");
    await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP1100", term: 1 }),
    });
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const card = page.locator('[data-placed="COMP1130"]');
      for (const name of ["Move to…", "Details", "Remove"]) {
        expect(await card.getByRole("button", { name, exact: true }).filter({ visible: true }).count()).toBe(0);
      }
      const controls = await cardMenu(page, "COMP1130").getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(await page.locator(`[id="${controls}"]`).count()).toBe(1);
      const other = await cardMenu(page, "COMP1100").getAttribute("aria-controls");
      expect(other).toBeTruthy();
      expect(other).not.toBe(controls);
    } finally {
      await page.close();
    }
  });

  it("lists Details, the Move to terms and Remove in order, and Escape closes it onto the toggle", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      const panel = page.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
      const order = await panel.evaluate((el) =>
        Array.from(el.children).map((child) =>
          child.matches("ul.card-menu-terms")
            ? `terms:${Array.from(child.querySelectorAll("button")).map((b) => b.textContent).join(",")}`
            : `${child.tagName.toLowerCase()}:${child.textContent}`,
        ),
      );
      expect(order[0]).toBe("button:Details");
      expect(order[1]).toBe("p:Move to");
      expect(order[2]).toMatch(/^terms:.+/);
      expect(order[2]).not.toContain("S1 2027");
      expect(order[3]).toBe("button:Remove");
      expect(order).toHaveLength(4);

      await panel.getByRole("button", { name: "Details" }).focus();
      await page.keyboard.press("Escape");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
        "More options for COMP1130",
      );
    });
  });

  it("Details in the menu closes it and opens the course's details", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      await page.locator('[data-placed="COMP1130"] .course-card-menu').getByRole("button", { name: "Details" }).click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      await expectDetailsOpenThenClose(page, "COMP1130");
    });
  });

  it("a term in the menu moves the course there", async () => {
    await withFreshPlan(desktop, async (page) => {
      await cardMenu(page, "COMP1130").click();
      await page.locator('[data-placed="COMP1130"] .card-menu-terms').getByRole("button", { name: "S1 2028" }).click();
      await expect.poll(() => page.locator('[data-term="2"] [data-placed="COMP1130"]').count()).toBe(1);
    });
  });

  it("Remove in the menu removes the course, with Undo", async () => {
    await withFreshPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      await cardMenu(page, "COMP1130").click();
      await card.locator(".course-card-menu").getByRole("button", { name: "Remove" }).click();
      await expect.poll(() => card.count()).toBe(0);
      const toast = page.locator(".undo-toast");
      await expect.poll(() => toast.count()).toBe(1);
      expect(await toast.textContent()).toContain("Removed COMP1130");
      await toast.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => card.count()).toBe(1);
    });
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the open panel stays inside the timeline", async (width, height) => {
    await withFreshPlan({ width, height }, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      const id = await toggle.getAttribute("aria-controls");
      const { panel, scroll } = await page.evaluate((panelId) => {
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        };
        return {
          panel: rect(document.getElementById(panelId!)!),
          scroll: rect(document.querySelector(".timeline-scroll")!),
        };
      }, id);
      expect(panel.width).toBeGreaterThan(0);
      expect(panel.left).toBeGreaterThanOrEqual(scroll.left);
      expect(panel.right).toBeLessThanOrEqual(scroll.right);
      expect(await horizontalOverflow(page)).toBe(0);

      // Horizontal bounds alone passed while .timeline-scroll (overflow-y:
      // hidden) clipped the panel's bottom off: check each button is really
      // what's under its own centre. scrollIntoView can scroll a hidden
      // overflow that a user never could, so no such ancestor may move.
      const hits = await page.evaluate((panelId) => {
        const buttons = Array.from(document.getElementById(panelId!)!.querySelectorAll("button"));
        return buttons.map((button) => {
          button.scrollIntoView({ block: "nearest" });
          const r = button.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const scrolledHidden: string[] = [];
          for (let el = button.parentElement; el; el = el.parentElement) {
            const oy = getComputedStyle(el).overflowY;
            if ((oy === "hidden" || oy === "clip") && el.scrollTop !== 0) scrolledHidden.push(el.className);
          }
          return { label: button.textContent, underCentre: !!hit && button.contains(hit), scrolledHidden };
        });
      }, id);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter((h) => !h.underCentre || h.scrolledHidden.length > 0)).toEqual([]);
    });
  });

  it("a floating card menu closes when the timeline scrolls, since it would be left behind", async () => {
    await withFreshPlan(desktop, async (page) => {
      const toggle = cardMenu(page, "COMP1130");
      await toggle.click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
      await page.locator(".timeline-scroll").evaluate((el) => el.scrollBy({ left: 200 }));
      await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("is clean under axe with a card menu open", async () => {
    await withFreshPlan(desktop, async (page) => {
      await cardMenu(page, "COMP1130").click();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("a read-only plan renders no card menu and no Place in…, but titles still open Details", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator("[data-placed]").count()).toBeGreaterThan(0);
      expect(await page.locator(".course-card-menu").count()).toBe(0);
      expect(await page.getByRole("button", { name: "Place in…" }).count()).toBe(0);
      const card = page.locator("[data-placed]").first();
      const code = (await card.getAttribute("data-placed"))!;
      await card.locator(".course-card-title").click();
      await expectDetailsOpenThenClose(page, code);
    });
  });

  it("on /plan/example no timeline card shows a disabled button", async () => {
    await withPlan(desktop, async (page) => {
      const buttons = page.locator("[data-placed] button").filter({ visible: true });
      expect(await buttons.count()).toBeGreaterThan(0);
      expect(await page.locator("[data-placed] button:disabled").filter({ visible: true }).count()).toBe(0);
    });
  });

  it("keeps a soft card's prerequisite suggestions visible with the menu closed", async () => {
    const created = await fetch(new URL("/api/plans", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      redirect: "manual",
    });
    const id = created.headers.get("location")!.split("/").pop()!;
    await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "COMP2100", term: 3 }),
    });
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const suggestions = page.locator('[data-placed="COMP2100"] .course-card-suggestions button');
      expect(await suggestions.count()).toBeGreaterThan(0);
      expect(await suggestions.first().isVisible()).toBe(true);
      expect(await cardMenu(page, "COMP2100").getAttribute("aria-expanded")).toBe("false");
    } finally {
      await page.close();
    }
  });
});

describe("family colours", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const FOUNDATIONS = "rgb(31, 47, 134)";
  const NEUTRAL = "rgb(141, 146, 153)";
  const GOLD = "rgb(190, 131, 14)";
  const rgb: Record<string, string> = {
    foundations: FOUNDATIONS,
    specialisation: "rgb(140, 95, 201)",
    advanced: "rgb(58, 143, 194)",
    ict: "rgb(176, 64, 125)",
    capstone: "rgb(61, 70, 80)",
    neutral: NEUTRAL,
  };

  const style = (page: Page, selector: string, prop: string) =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  it("strips a timeline card in its family colour", async () => {
    await withPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP1130"]');
      expect(await card.getAttribute("data-family")).toBe("foundations");
      expect(await style(page, '[data-placed="COMP1130"]', "box-shadow")).toContain(FOUNDATIONS);
    });
  });

  it("gives a card counting toward Electives no strip", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator('[data-placed="INFS1001"]').getAttribute("data-family")).toBe("neutral");
      expect(await style(page, '[data-placed="INFS1001"]', "box-shadow")).toBe("none");
    });
  });

  it("puts a hidden family dot beside Counts toward, keeping the text", async () => {
    await withPlan(desktop, async (page) => {
      const selector = '[data-placed="COMP1130"] .course-card-allocation .family-dot';
      expect(await page.locator(selector).count()).toBe(1);
      expect(await style(page, selector, "background-color")).toBe(FOUNDATIONS);
      expect(await page.locator(selector).getAttribute("aria-hidden")).toBe("true");
      expect(await page.locator('[data-placed="COMP1130"] .course-card-allocation').textContent()).toContain(
        "Counts toward Programming as Problem Solving",
      );
    });
  });

  it("dots top-level headings only, and not Electives", async () => {
    await withPlan(desktop, async (page) => {
      expect(await page.locator('[data-group="prog-a"] > h2 .family-dot').count()).toBe(1);
      expect(await page.locator('[data-group="spec"] > h2 .family-dot').count()).toBe(1);
      expect(await page.locator('[data-group="electives"] > h2').count()).toBe(1);
      expect(await page.locator('[data-group="electives"] > h2 .family-dot').count()).toBe(0);
      expect(await page.locator("[data-group] h3").count()).toBeGreaterThan(0);
      expect(await page.locator(":is(h3, h4, h5, h6) .family-dot").count()).toBe(0);
    });
  });

  it("keeps sidebar cards, compact rows and search results unstriped", async () => {
    await withPlan(desktop, async (page) => {
      const shadows = await page
        .locator(".available-courses .course-card, .placed-row")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
      expect(await page.locator(".available-courses .course-card").count()).toBeGreaterThan(0);
      expect(await page.locator(".placed-row").count()).toBeGreaterThan(0);
      expect(shadows.filter((s) => s !== "none")).toEqual([]);
    });
  });

  it("colours each group's progress bar by family, and leaves Total and the checks gold", async () => {
    await withPlan(desktop, async (page) => {
      expect(await style(page, '[data-group="prog-a"] .progress-bar-completed', "background-color")).toBe(FOUNDATIONS);
      expect(await style(page, '[data-group="prog-a"] .progress-bar-planned', "background-color")).not.toBe(
        "rgb(245, 237, 222)",
      );
      expect(await style(page, '[data-group="electives"] .progress-bar-completed', "background-color")).toBe(NEUTRAL);
      const total = page.locator(".requirement-group").filter({ has: page.locator("h2", { hasText: /^Total$/ }) });
      expect(await total.count()).toBe(1);
      expect(
        await total.locator(".progress-bar-completed").first().evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe(GOLD);
      expect(await style(page, ".checks-list .progress-bar-completed", "background-color")).toBe(GOLD);
      // The example's COMP2620 counts toward the AI specialisation's foundations.
      expect(await style(page, '[data-group="arin-a"] .progress-bar-completed', "background-color")).toBe(
        "rgb(140, 95, 201)",
      );
      // Its completed segment is 0% wide (COMP2620 is planned), so check the
      // planned segment actually shows, in violet.
      const planned = page.locator('[data-group="arin-a"] .progress-bar-planned').first();
      expect(await planned.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(0);
      expect(await planned.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(140, 95, 201)");
    });
  });

  it("hatches every family bar's planned segment, and leaves Total and the checks plain", async () => {
    await withPlan(desktop, async (page) => {
      const bars = await page
        .locator("[data-group] > .progress-bar[data-family]")
        .evaluateAll((els) =>
          els.map((el) => ({
            family: el.getAttribute("data-family")!,
            image: getComputedStyle(el.querySelector(".progress-bar-planned")!).backgroundImage,
          })),
        );
      expect(bars.length).toBeGreaterThan(0);
      for (const { family, image } of bars) {
        expect(image, family).toContain("repeating-linear-gradient");
        expect(image, family).toContain(rgb[family]);
      }
      const total = page.locator(".requirement-group").filter({ has: page.locator("h2", { hasText: /^Total$/ }) });
      expect(
        await total.locator(".progress-bar-planned").first().evaluate((el) => getComputedStyle(el).backgroundImage),
      ).toBe("none");
      expect(await style(page, ".checks-list .progress-bar-planned", "background-image")).toBe("none");
    });
  });

  it("draws a per-term family bar with a text equivalent", async () => {
    await withPlan(desktop, async (page) => {
      const bars = page.locator("[data-term] .term-bar");
      expect(await bars.count()).toBe(8);
      for (const bar of await bars.all()) {
        expect(await bar.getAttribute("role")).toBe("img");
        expect(await bar.getAttribute("aria-label")).toMatch(/^(\d|No units planned$)/);
      }
      const first = page.locator('[data-term="0"] .term-bar');
      const segments = first.locator(".term-bar-segment");
      expect(await segments.count()).toBeGreaterThan(0);
      const { sum, width } = await first.evaluate((el) => ({
        sum: [...el.querySelectorAll(".term-bar-segment")].reduce((t, s) => t + s.getBoundingClientRect().width, 0),
        width: el.clientWidth,
      }));
      expect(Math.abs(sum - width)).toBeLessThanOrEqual(1);
      const familyColours = [
        FOUNDATIONS,
        "rgb(140, 95, 201)",
        "rgb(58, 143, 194)",
        "rgb(176, 64, 125)",
        "rgb(61, 70, 80)",
        NEUTRAL,
      ];
      expect(familyColours).toContain(
        await segments.first().evaluate((el) => getComputedStyle(el).backgroundColor),
      );
    });
  });

  it("hatches the family bar of planned terms only", async () => {
    await withPlan(desktop, async (page) => {
      const segments = await page.locator("[data-term] .term-bar-segment").evaluateAll((els) =>
        els.map((el) => ({
          term: Number(el.closest("[data-term]")!.getAttribute("data-term")),
          family: el.getAttribute("data-family")!,
          image: getComputedStyle(el).backgroundImage,
        })),
      );
      // The example is completed through S2 2027 (cutoff 2).
      const completed = segments.filter((s) => s.term < 2);
      const planned = segments.filter((s) => s.term >= 2);
      expect(completed.length).toBeGreaterThan(0);
      expect(planned.length).toBeGreaterThan(0);
      for (const s of completed) expect(s.image, `term ${s.term} ${s.family}`).toBe("none");
      for (const s of planned) {
        expect(s.image, `term ${s.term} ${s.family}`).toContain("repeating-linear-gradient");
        expect(s.image, `term ${s.term} ${s.family}`).toContain(rgb[s.family]);
      }
    });
  });

  it("stays axe-clean", async () => {
    await withPlan(desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});
