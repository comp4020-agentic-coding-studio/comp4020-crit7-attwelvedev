import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage } from "../browser";
import { baseUrl, browser, useBrowser } from "./helpers";

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
});
