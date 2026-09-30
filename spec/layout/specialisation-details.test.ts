import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { baseUrl, browser, openSearch, planWithPlacement, useBrowser } from "./helpers";

useBrowser();

describe("specialisation details", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  const example = (query: string) => new URL(`/plan/example?${query}`, baseUrl).href;
  const specPanel = (page: Page) => page.locator('aside[aria-label="Specialisation details"]');
  const section = (page: Page, name: string) =>
    specPanel(page)
      .locator("section.details-section")
      .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
  const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);

  async function withSpec(code: string, viewport: typeof desktop, check: (page: Page) => Promise<void>) {
    const page = await openPage(browser, example(`spec=${code}`), viewport);
    try {
      await check(page);
    } finally {
      await page.close();
    }
  }

  it("the course panel still renders through the shared frame", async () => {
    const page = await openPage(browser, example("course=COMP2100"), desktop);
    try {
      const panel = page.locator('aside#course-details[aria-label="Course details"]');
      expect(await panel.count()).toBe(1);
      const nav = panel.locator(".details-nav");
      for (const name of ["Back", "Forward", /^(Narrow|Widen) details$/, "Close details"]) {
        expect(await nav.getByRole("button", { name, exact: typeof name === "string" }).count()).toBe(1);
      }
    } finally {
      await page.close();
    }
    const small = await openPage(browser, example("course=COMP2100"), phone);
    try {
      const panel = small.locator('aside#course-details[aria-label="Course details"]');
      expect(await panel.getByRole("slider", { name: "Resize details" }).count()).toBe(1);
    } finally {
      await small.close();
    }
  });

  it("renders ?spec= open on the server", async () => {
    const html = await (await fetch(example("spec=ARIN-SPEC"))).text();
    expect(html).toContain('aria-label="Specialisation details"');
    expect(html).toContain("ARIN-SPEC");
  });

  it("shows the chosen spec's P&C page, in P&C's order", async () => {
    await withSpec("ARIN-SPEC", desktop, async (page) => {
      const panel = specPanel(page);
      const h2 = await panel.locator("h2").textContent();
      for (const text of ["ARIN-SPEC", "24 units, Specialisation", "Artificial Intelligence"]) expect(h2).toContain(text);
      expect(await panel.locator(".details-pills li").allTextContents()).toContain("Chosen");
      expect(await panel.locator("h3").allTextContents()).toEqual([
        "In your plan",
        "Requirements",
        "About the specialisation",
        "Learning outcomes",
        "Other information",
        "Relevant degrees",
      ]);
      const heading = panel.getByRole("heading", { level: 4, name: "A maximum of 12 units from the following list:" });
      expect(await heading.count()).toBe(1);
      const tag = heading.locator("xpath=following-sibling::*[1]");
      expect(await tag.getAttribute("class")).toBe("spec-group-tag");
      expect(await tag.getByRole("button", { name: "foundations (max 12)" }).count()).toBe(1);
      const line = panel.locator(".spec-courses li").filter({ hasText: "COMP2620" });
      expect(await line.locator(".spec-units").textContent()).toBe("6 units");
    });
  });

  it("opens a course from P&C prose, and Back returns to the spec", async () => {
    await withSpec("ARIN-SPEC", desktop, async (page) => {
      await section(page, "Other information").getByRole("button", { name: "COMP4691" }).click();
      await page.locator('aside[aria-label="Course details"] h2').filter({ hasText: "COMP4691" }).waitFor();
      await expect.poll(() => param(page, "course")).toBe("COMP4691");
      expect(param(page, "spec")).toBeNull();
      await page.locator('aside[aria-label="Course details"]').getByRole("button", { name: "Back" }).click();
      await specPanel(page).locator("h2").filter({ hasText: "ARIN-SPEC" }).waitFor();
      await expect.poll(() => param(page, "spec")).toBe("ARIN-SPEC");
      expect(param(page, "course")).toBeNull();
    });
  });

  it("shows an unchosen spec's headings, ANDs and plain tags", async () => {
    await withSpec("HCCC-SPEC", desktop, async (page) => {
      const panel = specPanel(page);
      expect(await panel.getByRole("heading", { level: 4, name: "Advice to Students" }).count()).toBe(1);
      expect(await panel.locator(".spec-and").count()).toBe(2);
      expect(await panel.locator(".details-pills li").allTextContents()).toContain("Not chosen");
      const tag = panel.locator(".spec-group-tag").filter({ hasText: "foundations (max 6)" });
      expect(await tag.count()).toBe(1);
      expect(await tag.getByRole("button").count()).toBe(0);
      expect(await panel.getByRole("heading", { level: 3, name: "In your plan" }).count()).toBe(0);
    });
  });

  it("lists SYAR's topics", async () => {
    await withSpec("SYAR-SPEC", desktop, async (page) => {
      expect(await specPanel(page).locator(".spec-topics li").count()).toBe(13);
    });
  });

  it("ignores an unknown spec code", async () => {
    await withSpec("NOPE-SPEC", desktop, async (page) => {
      expect(await page.locator("aside#course-details").count()).toBe(0);
    });
  });

  it("jumps to the chosen spec's progress in Requirements", async () => {
    await withSpec("ARIN-SPEC", desktop, async (page) => {
      await specPanel(page).getByRole("button", { name: "See your progress in Requirements" }).click();
      await expect
        .poll(() => page.locator('[data-group="arin"]').evaluate((el) => el.classList.contains("requirement-highlighted")))
        .toBe(true);
    });
  });

  it("clamps the introduction behind Read the full description", async () => {
    await withSpec("ARIN-SPEC", desktop, async (page) => {
      const more = specPanel(page).getByRole("button", { name: "Read the full description" });
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      await more.click();
      await expect
        .poll(() => specPanel(page).locator(".details-more").getAttribute("aria-expanded"))
        .toBe("true");
    });
  });

  it("is axe-clean at 1920", async () => {
    await withSpec("ARIN-SPEC", desktop, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("on a phone, the jump shows Requirements and drops the sheet to peek", async () => {
    await withSpec("ARIN-SPEC", phone, async (page) => {
      expect(await axeViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
      await specPanel(page).getByRole("button", { name: "See your progress in Requirements" }).click();
      await expect
        .poll(() => page.getByRole("button", { name: "Requirements", exact: true }).getAttribute("aria-pressed"))
        .toBe("true");
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("peek");
      // A height change re-renders the frame alone, which must redraw the
      // spec's body as it was.
      await specPanel(page).getByRole("slider", { name: "Resize details" }).press("End");
      await expect.poll(() => specPanel(page).getAttribute("data-detent")).toBe("full");
      expect(await specPanel(page).locator(".spec-group-tag").count()).toBe(2);
    });
  });

  // Opens `url` with `setup` (routes, request listeners) already in place
  // for the panel's first what-if, which it sends as soon as it mounts.
  async function openPrepared(url: string, setup: (page: Page) => Promise<void>, check: (page: Page) => Promise<void>) {
    const page = await openPage(browser, example(""), desktop);
    try {
      await setup(page);
      await page.goto(url, { waitUntil: "networkidle" });
      await check(page);
    } finally {
      await page.close();
    }
  }
  const whatIfRequests = (page: Page) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/what-if")) seen.push(r.url());
    });
    return seen;
  };
  const fitText = (page: Page, text: string) => specPanel(page).getByText(text, { exact: true });

  it("shows a loading line while the what-if is on its way", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      await page.route("**/what-if*", async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        await route.continue();
      });
      await page.goto(example("spec=SYAR-SPEC"), { waitUntil: "domcontentloaded" });
      const loading = fitText(page, "Working out how this would fit your plan…");
      await expect.poll(() => loading.count()).toBe(1);
      await expect.poll(() => loading.count(), { timeout: 5000 }).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("offers Try again when the what-if fails", async () => {
    await openPrepared(
      example("spec=SYAR-SPEC"),
      async (page) => {
        await page.route("**/what-if*", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
      },
      async (page) => {
        const error = fitText(page, "Couldn't work out how this fits your plan.");
        await expect.poll(() => error.count()).toBe(1);
        await page.unroute("**/what-if*");
        await specPanel(page).getByRole("button", { name: "Try again" }).click();
        await expect.poll(() => error.count()).toBe(0);
      },
    );
  });

  it("asks again when the plan changes under an open panel", async () => {
    const id = await planWithPlacement("COMP3670", 5);
    let seen: string[] = [];
    await openPrepared(
      new URL(`/plan/${id}?spec=ARIN-SPEC`, baseUrl).href,
      async (page) => {
        seen = whatIfRequests(page);
      },
      async (page) => {
        // Settled at load, where the panel's move into the measured layout
        // can already have asked twice; the plan change must ask once more.
        const settled = seen.length;
        expect(settled).toBeGreaterThan(0);
        await page.locator("button.completed-toggle").click();
        await page.locator(".completed-panel").getByRole("button", { name: "S2 2027" }).click();
        await expect.poll(() => seen.length).toBe(settled + 1);
      },
    );
  });

  const choose = (id: string, childId: string) =>
    fetch(new URL(`/api/plans/${id}/choices`, baseUrl), {
      method: "PUT",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ groupId: "spec", childId }),
    });
  const toast = (page: Page) => page.locator(".undo-toast");
  const fit = (page: Page) => section(page, "Fit with your plan");

  it("shows a read-only plan the fit, with no button", async () => {
    await withSpec("SYAR-SPEC", desktop, async (page) => {
      const bar = specPanel(page).getByRole("progressbar", { name: "If you chose this" });
      await expect.poll(() => bar.count()).toBe(1);
      expect(await specPanel(page).getByRole("button", { name: /^(Choose|Switch)/ }).count()).toBe(0);
      expect(await fit(page).textContent()).toMatch(/would (move|count) here|None of your courses/);
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it("chooses and then switches from the panel, with undo", async () => {
    const id = await planWithPlacement("COMP3670", 5);
    const page = await openPage(browser, new URL(`/plan/${id}?spec=ARIN-SPEC`, baseUrl).href, desktop);
    try {
      const panel = specPanel(page);
      const line = section(page, "Requirements").locator(".spec-courses li").filter({ hasText: "COMP3670" }).first();
      await expect.poll(() => line.locator(".requisite-where").textContent()).toContain("would count");

      const moves = fit(page)
        .getByRole("heading", { level: 4, name: "Your courses that would count" })
        .locator("xpath=following-sibling::ul[1]");
      await expect.poll(() => moves.locator("li").filter({ hasText: "COMP3670" }).count()).toBe(1);
      expect(await moves.locator(".spec-move").count()).toBeGreaterThan(0);

      const chooseButton = panel.getByRole("button", { name: "Choose this specialisation" });
      expect(await chooseButton.getAttribute("class")).toContain("details-choose");
      await chooseButton.click();
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Chose Artificial Intelligence for Specialisation.");
      await expect.poll(() => panel.locator(".details-pills li").allTextContents()).toContain("Chosen");
      expect(await panel.getByRole("heading", { level: 3, name: "In your plan" }).count()).toBe(1);
      expect(await panel.getByRole("heading", { level: 3, name: "Fit with your plan" }).count()).toBe(0);

      await page.goto(new URL(`/plan/${id}?spec=HCCC-SPEC`, baseUrl).href, { waitUntil: "networkidle" });
      const switchButton = panel.getByRole("button", { name: "Switch to this specialisation" });
      expect((await switchButton.getAttribute("class")) ?? "").not.toContain("details-choose");
      const leaving = fit(page)
        .getByRole("heading", { level: 4, name: "Would stop counting toward Artificial Intelligence" })
        .locator("xpath=following-sibling::ul[1]");
      await expect.poll(() => leaving.locator("li").filter({ hasText: "COMP3670" }).count()).toBe(1);
      await switchButton.click();
      await expect.poll(() => toast(page).textContent()).toContain(
        "Switched Specialisation from Artificial Intelligence to Human-Centred & Creative Computing.",
      );
      await toast(page).getByRole("button", { name: "Undo" }).click();
      const fieldset = page.getByRole("group", { name: "Choose Specialisation" });
      await expect
        .poll(() => fieldset.getByRole("radio", { name: "Artificial Intelligence", exact: true }).isChecked())
        .toBe(true);
    } finally {
      await page.close();
    }
  });

  it("says Switched when the radio changes an existing choice", async () => {
    const id = await planWithPlacement("COMP3670", 5);
    expect((await choose(id, "arin")).status).toBe(200);
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await page
        .getByRole("group", { name: "Choose Specialisation" })
        .getByRole("radio", { name: "Human-Centred & Creative Computing" })
        .click();
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Switched Specialisation from");
    } finally {
      await page.close();
    }
  });

  it("asks nothing for the chosen spec", async () => {
    let seen: string[] = [];
    await openPrepared(
      example("spec=ARIN-SPEC"),
      async (page) => {
        seen = whatIfRequests(page);
      },
      async () => {
        expect(seen).toEqual([]);
      },
    );
  });

  const specFieldset = (page: Page) => page.getByRole("group", { name: "Choose Specialisation" });

  it("puts a Details button beside each specialisation option, and none beside a capstone", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      expect(await specFieldset(page).getByRole("button").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))).toEqual([
        "Details: Artificial Intelligence",
        "Details: Human-Centred & Creative Computing",
        "Details: Systems & Architecture",
        "Details: Theoretical Computer Science",
      ]);
      expect(await page.getByRole("group", { name: "Choose Capstone" }).getByRole("button").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("opens a spec from its Details button without choosing it", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      const details = specFieldset(page).getByRole("button", { name: "Details: Systems & Architecture" });
      await details.click();
      await specPanel(page).locator("h2").filter({ hasText: "SYAR-SPEC" }).waitFor();
      await expect.poll(() => param(page, "spec")).toBe("SYAR-SPEC");
      expect(await details.getAttribute("aria-current")).toBe("true");
      expect(await specFieldset(page).getByRole("radio", { name: "Artificial Intelligence" }).isChecked()).toBe(true);
      expect(await specFieldset(page).getByRole("radio", { name: "Systems & Architecture" }).isChecked()).toBe(false);
    } finally {
      await page.close();
    }
  });

  it("still chooses an option from its label's text", async () => {
    const id = await planWithPlacement("COMP1130");
    const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, desktop);
    try {
      await specFieldset(page).getByText("Artificial Intelligence", { exact: true }).click();
      await expect.poll(() => toast(page).count()).toBe(1);
      expect(await toast(page).textContent()).toContain("Chose Artificial Intelligence for Specialisation.");
    } finally {
      await page.close();
    }
  });

  it("opens the chosen spec from its sidebar heading, tinting the group while open", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      const group = page.locator('[data-group="arin"]');
      const tinted = () => group.evaluate((el) => el.classList.contains("group-linked"));
      expect(await tinted()).toBe(false);
      await group.locator("> h3 button").click();
      await specPanel(page).locator("h2").filter({ hasText: "ARIN-SPEC" }).waitFor();
      await expect.poll(tinted).toBe(true);
      await specPanel(page).getByRole("button", { name: "Close details" }).click();
      await expect.poll(tinted).toBe(false);
    } finally {
      await page.close();
    }
  });

  it("is axe-clean with a spec opened from its Details button", async () => {
    for (const viewport of [desktop, phone]) {
      const page = await openPage(browser, example(""), viewport);
      try {
        if (viewport === phone) await page.getByRole("button", { name: "Requirements", exact: true }).click();
        await specFieldset(page).getByRole("button", { name: "Details: Human-Centred & Creative Computing" }).click();
        await specPanel(page).locator("h2").filter({ hasText: "HCCC-SPEC" }).waitFor();
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await page.close();
      }
    }
  });

  async function search(page: Page, query: string) {
    await openSearch(page);
    await page.locator(".palette input").fill(query);
    await page.locator(".palette input").press("Enter");
    await page.locator(".palette .course-search-status").filter({ hasText: "Searching" }).waitFor({ state: "detached" });
  }
  const palette = (page: Page) => page.locator(".palette");

  it("finds a specialisation by its code in search, and opens it from the keyboard", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      await search(page, "ARIN");
      await expect.poll(() => palette(page).locator(".palette-spec-row").count()).toBe(1);
      expect(await palette(page).getByRole("heading", { level: 3, name: "Specialisations" }).count()).toBe(1);
      const row = await palette(page).locator(".palette-spec-row").textContent();
      for (const text of ["ARIN-SPEC", "Artificial Intelligence", "24 units, Specialisation", "Chosen"]) expect(row).toContain(text);
      expect(await palette(page).locator(".course-search-status").count()).toBe(0);

      await palette(page).locator("input").press("ArrowDown");
      expect(await page.evaluate(() => document.activeElement?.classList.contains("palette-spec-title"))).toBe(true);
      await page.keyboard.press("Enter");
      await specPanel(page).locator("h2").filter({ hasText: "ARIN-SPEC" }).waitFor();
      expect(await palette(page).count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("lists a title match above the course results", async () => {
    const page = await openPage(browser, example(""), desktop);
    try {
      await search(page, "artificial intelligence");
      await expect.poll(() => palette(page).locator(".palette-spec-row").count()).toBe(1);
      const courses = palette(page).locator(".course-search-results, .course-search-placed");
      await expect.poll(() => courses.filter({ hasText: "COMP3620" }).count()).toBe(1);
      const specTop = (await palette(page).locator(".palette-specs").boundingBox())!.y;
      for (const box of await courses.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))) {
        expect(box).toBeGreaterThan(specTop);
      }
    } finally {
      await page.close();
    }
  });

  it("is axe-clean with specialisation results shown", async () => {
    for (const viewport of [desktop, phone]) {
      const page = await openPage(browser, example(""), viewport);
      try {
        await search(page, "ARIN");
        await expect.poll(() => palette(page).locator(".palette-spec-row").count()).toBe(1);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await page.close();
      }
    }
  });
});

describe("the what-if endpoint", () => {
  const whatIf = (planId: string, query: string) => fetch(new URL(`/api/plans/${planId}/what-if?${query}`, baseUrl));

  it("answers for a real option, and rejects anything else", async () => {
    const id = await planWithPlacement("COMP3670", 5);
    const ok = await whatIf(id, "group=spec&option=arin");
    expect(ok.status).toBe(200);
    expect((await ok.json()).optionId).toBe("arin");
    expect((await whatIf(id, "group=spec&option=nope")).status).toBe(400);
    expect((await whatIf(id, "group=electives&option=arin")).status).toBe(400);
    expect((await whatIf(id, "group=spec")).status).toBe(400);
    expect((await whatIf("no-such-plan", "group=spec&option=arin")).status).toBe(404);
  });

  it("reads a read-only plan too", async () => {
    expect((await whatIf("example", "group=spec&option=syar")).status).toBe(200);
  });
});
