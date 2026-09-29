import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { axeViolations, horizontalOverflow, openPage, verticalOverflow, type Viewport } from "../browser";
import { browser, detailsPanel, openSearch, planUrl, settle, useBrowser } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };
const laptop = { width: 1280, height: 800 };
const tablet = { width: 900, height: 800 };
const phone = { width: 390, height: 844 };

const courseUrl = () => `${planUrl()}?course=COMP2100`;

const openDetails = async (page: Page, mode: string) => {
  await detailsPanel(page).waitFor();
  await expect.poll(() => detailsPanel(page).getAttribute("data-mode")).toBe(mode);
  await settle(page);
};

const searchFor = async (page: Page, query: string) => {
  await openSearch(page);
  await page.locator(".palette input").fill(query);
  await page.locator(".palette").getByRole("button", { name: "Search", exact: true }).click();
  await page.locator(".palette .course-search-results").waitFor();
};

const showTab = async (page: Page, name: "Timeline" | "Requirements") => {
  await page.getByRole("navigation", { name: "Plan view" }).getByRole("button", { name, exact: true }).click();
  await settle(page);
};

// The phone sheet opens at half; its handle's Home and End keys go to the
// peek and full heights.
const sheetAt = (detent: "peek" | "half" | "full") => async (page: Page) => {
  await openDetails(page, "sheet");
  const key = { peek: "Home", half: null, full: "End" }[detent];
  if (key) {
    await detailsPanel(page).getByRole("slider", { name: "Resize details" }).focus();
    await page.keyboard.press(key);
  }
  await expect.poll(() => detailsPanel(page).getAttribute("data-detent")).toBe(detent);
  await settle(page);
};

interface State {
  name: string;
  viewport: Viewport;
  url: () => string;
  reach: (page: Page) => Promise<void>;
}

// Every state the workspace redesign can put the plan page in (Phase 08
// §4), each checked the same way: clean under axe, nothing sideways, and
// the fitted page not scrolling.
const STATES: State[] = [
  { name: "1920: details closed", viewport: desktop, url: planUrl, reach: async (page) => void (await settle(page)) },
  {
    name: "1920: details open at 440",
    viewport: desktop,
    url: courseUrl,
    reach: async (page) => {
      await openDetails(page, "docked");
      expect(Math.round((await detailsPanel(page).boundingBox())!.width)).toBe(440);
    },
  },
  {
    name: "1920: details at 760",
    viewport: desktop,
    url: courseUrl,
    reach: async (page) => {
      await openDetails(page, "docked");
      await page.getByRole("button", { name: "Widen details" }).click();
      await expect.poll(async () => Math.round((await detailsPanel(page).boundingBox())!.width)).toBe(760);
      await settle(page);
    },
  },
  { name: "1920: palette open", viewport: desktop, url: planUrl, reach: (page) => searchFor(page, "COMP") },
  {
    name: "1920: a course open with linked highlights",
    viewport: desktop,
    url: planUrl,
    reach: async (page) => {
      await page.locator('[data-placed="COMP2100"] button.course-card-title').first().click();
      await openDetails(page, "docked");
      await expect.poll(() => page.locator(".badge-linked, .group-linked").count()).toBeGreaterThan(0);
    },
  },
  {
    name: "1280: requirements auto-folded",
    viewport: laptop,
    url: courseUrl,
    reach: async (page) => {
      await openDetails(page, "docked");
      await page.locator(".reqs-rail").waitFor();
    },
  },
  { name: "900: the details drawer", viewport: tablet, url: courseUrl, reach: (page) => openDetails(page, "drawer") },
  { name: "390: Timeline tab", viewport: phone, url: planUrl, reach: (page) => showTab(page, "Timeline") },
  { name: "390: Requirements tab", viewport: phone, url: planUrl, reach: (page) => showTab(page, "Requirements") },
  { name: "390: details sheet at peek", viewport: phone, url: courseUrl, reach: sheetAt("peek") },
  { name: "390: details sheet at half", viewport: phone, url: courseUrl, reach: sheetAt("half") },
  { name: "390: details sheet at full", viewport: phone, url: courseUrl, reach: sheetAt("full") },
  { name: "390: palette full-screen", viewport: phone, url: planUrl, reach: (page) => searchFor(page, "COMP") },
];

describe("workspace states", { timeout: 30_000 }, () => {
  it.each(STATES)("$name: axe clean, no overflow, fitted", async ({ viewport, url, reach }) => {
    const page = await openPage(browser, url(), viewport);
    try {
      await reach(page);
      expect(await axeViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
      // Every viewport here is at least 30rem tall, so the page is fitted.
      expect(await verticalOverflow(page)).toBe(0);
    } finally {
      await page.close();
    }
  });
});
