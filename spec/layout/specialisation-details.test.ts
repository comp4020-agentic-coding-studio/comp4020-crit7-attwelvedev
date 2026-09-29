import { describe, expect, it } from "vitest";
import { openPage } from "../browser";
import { baseUrl, browser, useBrowser } from "./helpers";

useBrowser();

describe("specialisation details", { timeout: 30_000 }, () => {
  const desktop = { width: 1920, height: 1080 };
  const phone = { width: 390, height: 844 };
  const example = (query: string) => new URL(`/plan/example?${query}`, baseUrl).href;

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
});
