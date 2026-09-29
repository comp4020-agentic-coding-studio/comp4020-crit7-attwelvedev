import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { baseUrl, browser, detailsPanel, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

describe("details sidebar", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const heading = (page: Page, name: string) =>
    detailsPanel(page).getByRole("heading", { name, exact: true });

  async function openFromCard(page: Page, code: string) {
    await page.locator(`[data-placed="${code}"] .course-card-title`).click();
    await detailsPanel(page).waitFor();
  }

  it("About loads after opening", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openFromCard(page, "COMP2100");
      await heading(page, "Learning outcomes").waitFor();
      expect(await detailsPanel(page).locator("ol li").count()).toBe(6);
      const assessment = await detailsPanel(page).locator(".details-assessment").textContent();
      expect(assessment).toContain("Assessment");
      expect(assessment).toContain("Final Exam");
      expect(assessment).toContain("45%");
    } finally {
      await page.close();
    }
  });

  it("stub course shows no extras", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await page.route("**/api/courses/*", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({ response, json: { ...body, extras: null } });
      });
      await openFromCard(page, "COMP2100");
      const panel = detailsPanel(page);
      await expect.poll(() => panel.textContent()).toContain("Only basic details are available for this course");
      expect(await heading(page, "Learning outcomes").count()).toBe(0);
      expect(await panel.locator('a[href="https://programsandcourses.anu.edu.au/2027/course/COMP2100"]').count()).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  });

  it("details fetch failure", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await page.route("**/api/courses/*", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
      await openFromCard(page, "COMP2100");
      const panel = detailsPanel(page);
      await expect.poll(() => panel.textContent()).toContain("Couldn't load the full details");
      expect(await panel.locator('a[href="https://programsandcourses.anu.edu.au/2027/course/COMP2100"]').count()).toBeGreaterThan(0);
      // Everything but About comes from the plan's own view.
      for (const name of ["In your plan", "Requisites"]) expect(await heading(page, name).count()).toBe(1);
    } finally {
      await page.close();
    }
  });

  it("the sidebar stays open when its course is removed", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openFromCard(page, "COMP2100");
      await detailsPanel(page).getByRole("button", { name: "Remove from plan" }).click();
      await expect.poll(() => page.locator('[data-placed="COMP2100"]').count()).toBe(0);
      expect(await detailsPanel(page).isVisible()).toBe(true);
      await expect.poll(() => detailsPanel(page).locator(".details-pills").textContent()).toContain("Not in your plan");
      // Nothing left to pin or remove, so the section goes.
      expect(await heading(page, "In your plan").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("the sidebar follows plan changes made elsewhere", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openFromCard(page, "COMP2100");
      const panel = detailsPanel(page);
      expect(await panel.locator(".details-pills").textContent()).toContain("Planned S1 2028");
      // Opening Details scrolls the card out from under the drawer. Let that
      // scroll finish first: any scroll closes an open card menu.
      const settled = () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const scroller = document.querySelector(".timeline-scroll")!;
              const before = scroller.scrollLeft;
              setTimeout(() => {
                const card = document.querySelector('[data-placed="COMP2100"]')!.getBoundingClientRect();
                const drawer = document.querySelector('aside[aria-label="Course details"]')!.getBoundingClientRect();
                resolve(scroller.scrollLeft === before && card.right <= drawer.left);
              }, 150);
            }),
        );
      await expect.poll(settled).toBe(true);
      await page.getByRole("button", { name: "More options for COMP2100" }).click();
      await page.locator('[data-placed="COMP2100"] .card-menu-terms').getByRole("button", { name: "S2 2028" }).click();
      await expect.poll(() => page.locator('[data-term="3"] [data-placed="COMP2100"]').count()).toBe(1);
      await expect.poll(() => panel.locator(".details-pills").textContent()).toContain("Planned S2 2028");
    } finally {
      await page.close();
    }
  });

  it("read-only details", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const panel = detailsPanel(page);
      expect(await panel.isVisible()).toBe(true);
      expect(await panel.getByRole("button", { name: "Remove from plan" }).count()).toBe(0);
      expect(await panel.locator(".pin-toggle").isDisabled()).toBe(true);
      // Every cell is refused on a read-only plan, but each keeps its own
      // state and reads at full strength.
      const offered = panel.locator('.strip-cell[data-state="offered"]');
      expect(await offered.count()).toBeGreaterThan(0);
      expect(await offered.first().isDisabled()).toBe(true);
      expect(await offered.first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the strip moves a course", async (width, height) => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, { width, height });
    try {
      const cell = detailsPanel(page).getByRole("button", { name: "Move to S2 2028", exact: true });
      expect(await cell.isEnabled()).toBe(true);
      await cell.click();
      await expect.poll(() => page.locator('section[data-term="3"] [data-placed="COMP2100"]').count()).toBe(1);
      expect(await detailsPanel(page).locator("h2").textContent()).toContain("COMP2100");
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the strip refuses a non-offered term, saying why", async (width, height) => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP1130`, baseUrl).href, { width, height });
    try {
      const cell = detailsPanel(page).getByRole("button", { name: "Move to S2 2027", exact: true });
      expect(await cell.isDisabled()).toBe(true);
      expect(await cell.textContent()).toContain("Not offered");
      const described = await cell.getAttribute("aria-describedby");
      expect(described).toBeTruthy();
      expect(await page.locator(`[id="${described}"]`).textContent()).toContain("isn't offered in S2 2027");
    } finally {
      await page.close();
    }
  });

  it("lists the offerings under the strip", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const table = detailsPanel(page).locator("table");
      expect(await table.locator("th").allTextContents()).toEqual(["Semester", "Delivery", "Class number"]);
      const row = table.locator("tr", { hasText: "5103" });
      expect(await row.count()).toBe(1);
      expect(await row.locator("td").allTextContents()).toEqual(["S1 2027", "In Person", "5103"]);
    } finally {
      await page.close();
    }
  });

  it("says in its footer where and when the details came from", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const footer = detailsPanel(page).locator("footer");
      const link = footer.getByRole("link", { name: "Open COMP2100 on Programs & Courses" });
      expect(await link.getAttribute("href")).toBe("https://programsandcourses.anu.edu.au/2027/course/COMP2100");
      expect(await footer.textContent()).toMatch(/Details from Programs & Courses 2027, updated \d{1,2} [A-Z][a-z]{2} \d{4}/);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i focus moves into the panel and back to what opened it", async (width, height) => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width, height });
    try {
      const title = page.locator('[data-placed="COMP1130"] .course-card-title');
      await title.click();
      await detailsPanel(page).waitFor();
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
      await detailsPanel(page).getByRole("button", { name: "Close details" }).click();
      await expect.poll(() => detailsPanel(page).count()).toBe(0);
      await expect.poll(() => title.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("Escape closes the panel when focus is inside it", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await openFromCard(page, "COMP1130");
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
      // From a control deeper in the panel, not just its heading.
      await detailsPanel(page).getByRole("button", { name: "Remove from plan" }).focus();
      await page.keyboard.press("Escape");
      await expect.poll(() => detailsPanel(page).count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("opening a placed course from its row scrolls its card into view, leaving focus in the panel", async () => {
    await withPlan(desktop, async (page) => {
      const card = page.locator('[data-placed="COMP4550"]');
      const scroller = page.locator(".timeline-scroll");
      const inView = () =>
        page.evaluate(() => {
          const c = document.querySelector('[data-placed="COMP4550"]')!.getBoundingClientRect();
          const s = document.querySelector(".timeline-scroll")!.getBoundingClientRect();
          const d = document.querySelector('aside[aria-label="Course details"]')?.getBoundingClientRect();
          return c.left >= s.left && c.right <= Math.min(s.right, d?.left ?? Infinity);
        });
      expect(await inView()).toBe(false);
      const row = page.locator(".placed-row", { hasText: "COMP4550" }).first();
      await row.locator(".placed-row-title").click();
      await detailsPanel(page).waitFor();
      await expect.poll(inView).toBe(true);
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      expect(await card.evaluate((el) => el.contains(document.activeElement))).toBe(false);
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
    });
  });

  it("marks the open course's card and row titles as current, and no other", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP1130", baseUrl).href, desktop);
    try {
      // Every course title is a button named "<title>, details"; menu options
      // use aria-current for their own choice, which isn't this.
      const current = page.locator('button[aria-current="true"][aria-label$=", details"]');
      expect(
        await current.evaluateAll((els) =>
          els.map((el) => `${el.className}|${el.closest("[data-placed]")?.getAttribute("data-placed") ?? el.closest(".placed-row")?.querySelector(".placed-row-code")?.textContent}`),
        ),
      ).toEqual(["course-card-title|COMP1130", "placed-row-title|COMP1130"]);
    } finally {
      await page.close();
    }
  });

  it("offers Remove for a completed course too, as its card menu does", async () => {
    const id = await planWithPlacement("COMP1130");
    const cutoff = await fetch(new URL(`/api/plans/${id}/cutoff`, baseUrl), {
      method: "PUT",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ cutoff: 1 }),
    });
    expect(cutoff.status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP1130`, baseUrl).href, desktop);
    try {
      const panel = detailsPanel(page);
      expect(await panel.locator(".details-pills").textContent()).toContain("Completed S1 2027");
      await panel.getByRole("button", { name: "Remove from plan" }).click();
      await expect.poll(() => page.locator('[data-placed="COMP1130"]').count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i every strip cell keeps each label on one line", async (width, height) => {
    // COMP4550 (two-semester, late) shows the longest words: In your plan,
    // Part 2, Needs prereqs and Can't start.
    const id = await planWithPlacement("COMP4550", 6);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP4550`, baseUrl).href, { width, height });
    try {
      const cells = detailsPanel(page).locator(".strip-cell");
      expect(await cells.count()).toBe(8);
      const broken = await cells.evaluateAll((els) =>
        els
          .filter(
            (cell) =>
              cell.scrollWidth > cell.clientWidth ||
              [...cell.querySelectorAll(".strip-state, .strip-units")].some((line) => {
                // The text's own line boxes: a flex item reports one box
                // however many lines its text takes.
                const range = document.createRange();
                range.selectNodeContents(line);
                return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1;
              }),
          )
          .map((cell) => cell.textContent),
      );
      expect(broken).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("has no drag grip in its header", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, desktop);
    try {
      expect(await detailsPanel(page).locator(".course-card-grip").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("picks Counts toward from the same popup as Completed through", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, desktop);
    try {
      const panel = detailsPanel(page);
      expect(await panel.locator("select").count()).toBe(0);
      const toggle = panel.locator(".pin-toggle");
      expect(await toggle.textContent()).toContain("Counts toward: Automatic");
      await toggle.click();
      const options = panel.locator(".pin-panel button");
      expect(await options.first().textContent()).toContain("Automatic");
      expect(await options.first().getAttribute("aria-current")).toBe("true");
      const group = (await options.nth(1).textContent())!.trim();
      await options.nth(1).click();
      await expect.poll(() => toggle.textContent()).toContain(`Counts toward: ${group}`);
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    } finally {
      await page.close();
    }
  });

  it("tells a term its prerequisites rule out from one that doesn't run the course, with a legend", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP1130", baseUrl).href, desktop);
    try {
      const panel = detailsPanel(page);
      expect(await panel.getByRole("button", { name: "Move to S2 2027", exact: true }).textContent()).toContain("Not offered");
      const legend = panel.locator(".strip-legend");
      for (const state of await panel.locator(".strip-cell").evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-state")))])) {
        // Part 2 looks like, and is keyed as, "In your plan".
        const keyed = state === "part2" ? "here" : state;
        expect(await legend.locator(`[data-state="${keyed}"]`).count(), state!).toBe(1);
      }
    } finally {
      await page.close();
    }
    const fresh = await openPage(browser, new URL(`/plan/${await planWithPlacement("COMP1130")}?course=COMP2100`, baseUrl).href, desktop);
    try {
      const cell = detailsPanel(fresh).getByRole("button", { name: "Place in S1 2027", exact: true });
      expect(await cell.textContent()).toContain("Needs prereqs");
      expect(await cell.isDisabled()).toBe(true);
    } finally {
      await fresh.close();
    }
  });

  it("draws the tree with guide lines, and says where each course leaf sits in the plan", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const tree = detailsPanel(page).locator(".requisite-tree");
      const nested = tree.locator("ul").first();
      expect(await nested.evaluate((el) => getComputedStyle(el).borderInlineStartWidth)).not.toBe("0px");
      // The innermost li holding the code: its and/or ancestors hold it too.
      const leaf = (code: string) => tree.locator("li", { has: page.locator(".requisite-code", { hasText: code }) }).last();
      expect(await leaf("COMP1140").textContent()).toContain("Structured Programming (Advanced)");
      expect(await leaf("COMP1140").locator(".requisite-where").textContent()).toBe("Completed S2 2027");
      expect(await leaf("COMP1110").locator(".requisite-where").textContent()).toBe("Not in your plan");
    } finally {
      await page.close();
    }
  });

  it("gives an unplaced course's tree plain dots, not marks", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP4680", baseUrl).href, desktop);
    try {
      const tree = detailsPanel(page).locator(".requisite-tree");
      expect(await tree.locator(".mark-dot").count()).toBeGreaterThan(0);
      expect(await tree.locator(".mark").count()).toBe(0);
      expect(await tree.textContent()).not.toMatch(/[✓✗?]/);
    } finally {
      await page.close();
    }
  });

  it("keys each assessment item to its bar segment by colour", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const assessment = detailsPanel(page).locator(".details-assessment");
      const colours = (selector: string) =>
        assessment.locator(selector).evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      const bar = await colours(".assess-bar span");
      const dots = await colours(".assess-dot");
      expect(dots).toHaveLength(3);
      expect(dots).toEqual(bar);
      expect(new Set(dots).size).toBe(3);
    } finally {
      await page.close();
    }
  });

  it("marks every P&C link as opening a new tab", async () => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, desktop);
    try {
      const links = detailsPanel(page).locator('a[target="_blank"]');
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        expect(await link.locator("svg.external-icon").count()).toBe(1);
        expect(await link.locator(".visually-hidden").textContent()).toBe(" (opens in a new tab)");
      }
    } finally {
      await page.close();
    }
  });

  it("shows Remove as destructive, in the panel and in the card menu", async () => {
    const id = await planWithPlacement("COMP2100", 2);
    const page = await openPage(browser, new URL(`/plan/${id}?course=COMP2100`, baseUrl).href, desktop);
    try {
      const rust = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--rust)";
        document.body.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      });
      const colour = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => getComputedStyle(el).color);
      expect(await colour(detailsPanel(page).getByRole("button", { name: "Remove from plan" }))).toBe(rust);
      expect(await colour(page.locator('[data-placed="COMP2100"] .card-menu-remove'))).toBe(rust);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i axe is clean with details open", async (width, height) => {
    const page = await openPage(browser, new URL("/plan/example?course=COMP2100", baseUrl).href, { width, height });
    try {
      expect(await detailsPanel(page).isVisible()).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });
});

describe("details requisites", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const example = (code: string) => new URL(`/plan/example?course=${code}`, baseUrl).href;
  const section = (page: Page, name: string) =>
    detailsPanel(page).locator(".details-section", { has: page.getByRole("heading", { name, exact: true }) });

  it("shows P&C's own wording", async () => {
    const page = await openPage(browser, example("COMP2100"), desktop);
    try {
      const raw = await (await fetch(new URL("/api/courses/COMP2100", baseUrl))).json();
      const written = detailsPanel(page).locator(".details-raw");
      expect(await written.textContent()).toContain("As written on Programs & Courses");
      expect((await written.textContent())!.replace(/\s+/g, " ")).toContain(raw.course.requisiteRaw.replace(/\s+/g, " ").trim());
    } finally {
      await page.close();
    }
  });

  it("labels postgraduate codes under Taught with and Can't take with", async () => {
    const page = await openPage(browser, example("COMP2100"), desktop);
    try {
      for (const name of ["Taught with", "Can't take with"]) {
        const list = detailsPanel(page).locator(".details-related", { has: page.getByRole("heading", { name, exact: true }) });
        expect(await list.textContent(), name).toContain("COMP6442 (postgraduate)");
      }
    } finally {
      await page.close();
    }
  });

  it("lists the plan's courses that need it, each opening its own details, with Back returning", async () => {
    const page = await openPage(browser, example("COMP2100"), desktop);
    try {
      const needs = section(page, "Courses in your plan that need it");
      const link = needs.getByRole("button", { name: /COMP2120/ });
      expect(await link.count()).toBe(1);
      await link.click();
      await expect.poll(() => detailsPanel(page).locator("h2").textContent()).toContain("COMP2120");
      await detailsPanel(page).getByRole("button", { name: "Back" }).click();
      await expect.poll(() => detailsPanel(page).locator("h2").textContent()).toContain("COMP2100");
    } finally {
      await page.close();
    }
  });

  it("draws an unplaced course's tree without marks", async () => {
    await withPlan(desktop, async (page) => {
      await page.locator(".course-card-unplaced").filter({ hasText: "COMP4680" }).locator(".course-card-title").click();
      await detailsPanel(page).waitFor();
      const tree = detailsPanel(page).locator(".requisite-tree");
      expect(await tree.count()).toBe(1);
      expect(await tree.textContent()).toContain("12 units");
      expect(await tree.textContent()).not.toMatch(/[✓✗]/);
      expect(await tree.locator(".mark").count()).toBe(0);
    });
  });
});

describe("manual checks", { timeout: 30_000 }, () => {
  // An editable plan with MATH1115 in S1 2027 and MATH1116 after it — the
  // MATH1116 mark items are then all that's left to verify.
  async function planWithMath1116(): Promise<string> {
    const id = await planWithPlacement("MATH1115");
    const placed = await fetch(new URL(`/api/plans/${id}/placements`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ code: "MATH1116", term: 1 }),
    });
    expect(placed.status).toBe(200);
    return id;
  }

  async function openDetails(page: Page, code: string) {
    await page.locator(`[data-placed="${code}"] .course-card-title`).click();
    const panel = detailsPanel(page);
    await panel.waitFor();
    return panel;
  }

  // The answer controls live in the tree, on the node they answer.
  const checkGroups = (panel: ReturnType<typeof detailsPanel>) => panel.locator(".requisite-tree [role=group]");

  const desktop = { width: 1920, height: 1080 };

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i each unverifiable node offers Met / Not met / Not sure, labelled with its course", async (width, height) => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width, height });
    try {
      const panel = await openDetails(page, "MATH1116");
      const groups = checkGroups(panel);
      expect(await groups.count()).toBe(2);
      expect(await groups.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))).toEqual([
        "MATH1115 with a mark of 60 or above",
        "MATH1113 with a mark of 80 or above",
      ]);
      for (const group of await groups.all()) {
        // Inside the tree node it answers, not in a list of its own.
        expect(await group.evaluate((el) => el.closest(".requisite-tree li")?.textContent)).toContain("with a mark of");
        const buttons = group.getByRole("button");
        expect(await buttons.allTextContents()).toEqual(["Met", "Not met", "Not sure"]);
        expect(await group.getByRole("button", { name: "Not sure", exact: true }).getAttribute("aria-pressed")).toBe("true");
        expect(await group.getByRole("button", { name: "Met", exact: true }).getAttribute("aria-pressed")).toBe("false");
      }
      expect(await panel.locator("fieldset").count()).toBe(0);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it.each([
    [1920, 1080],
    [390, 844],
  ])("at %i×%i the verify badge opens Details at Requisites", async (width, height) => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, { width, height });
    try {
      const card = page.locator('[data-placed="MATH1116"]');
      const badge = card.locator("button.badge-verify");
      expect(await badge.textContent()).toBe("Verify on P&C: 2 items");
      // Details lists the items in full; the card only counts them.
      expect(await card.textContent()).not.toContain("with a mark of 60");
      await badge.click();
      await detailsPanel(page).waitFor();
      await expect.poll(() => page.evaluate(() => document.activeElement?.textContent)).toBe("Requisites");
      expect(await horizontalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("answering Met on the MATH1115 mark makes the card Available and drops its verify line", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const panel = await openDetails(page, "MATH1116");
      await checkGroups(panel).first().getByRole("button", { name: "Met", exact: true }).click();
      const card = page.locator('[data-placed="MATH1116"]');
      await expect.poll(() => card.locator('[class*="badge-state-"]').textContent()).toBe("Available");
      expect(await card.locator(".badge-verify").count()).toBe(0);

      await page.reload({ waitUntil: "networkidle" });
      const reopened = await openDetails(page, "MATH1116");
      expect(
        await checkGroups(reopened).first().getByRole("button", { name: "Met", exact: true }).getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      await page.close();
    }
  });

  it("Not met turns the card amber with its reason", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const panel = await openDetails(page, "MATH1116");
      await checkGroups(panel).first().getByRole("button", { name: "Not met", exact: true }).click();
      const card = page.locator('[data-placed="MATH1116"]');
      await expect.poll(() => card.locator(".badge-state-soft").count()).toBe(1);
      expect(await card.locator(".badge-reason").textContent()).toContain(
        'You marked "MATH1115 with a mark of 60 or above" as not met',
      );
    } finally {
      await page.close();
    }
  });

  it("the read-only example's check controls are disabled", async () => {
    await withPlan(desktop, async (page) => {
      const panel = await openDetails(page, "COMP4550");
      const buttons = checkGroups(panel).getByRole("button");
      expect(await buttons.count()).toBeGreaterThan(0);
      for (const button of await buttons.all()) expect(await button.isDisabled()).toBe(true);
    });
  });

  it("the requisite tree says an answer was marked by you", async () => {
    const id = await planWithMath1116();
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      const panel = await openDetails(page, "MATH1116");
      const group = checkGroups(panel).first();
      await group.getByRole("button", { name: "Met", exact: true }).click();
      await expect
        .poll(() => panel.locator(".requisite-tree li", { has: page.locator("[role=group]") }).first().textContent())
        .toContain("Marked by you");
    } finally {
      await page.close();
    }
  });
});
