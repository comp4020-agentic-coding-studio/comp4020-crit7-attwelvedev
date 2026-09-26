import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// spec/readme.test.ts already checks /readme/ serves the whole of README.md.
// This checks the *content* the plan requires: what the app is, what good
// means, the brief overrides, every stated limitation, and attribution — and
// that the starter's template heading is actually gone.
const baseUrl = inject("baseUrl");

describe("readme content", () => {
  it("covers what good means, the brief overrides and every stated limitation", async () => {
    const res = await fetch(new URL("/readme/", baseUrl));
    expect(res.status).toBe(200);
    const text = new JSDOM(await res.text()).window.document.body.textContent ?? "";

    for (const phrase of ["Limitations", "Programs & Courses", "2027", "single allocation", "projected"]) {
      expect(text, `/readme/ is missing "${phrase}"`).toContain(phrase);
    }
    expect(text).not.toContain("Your prototype");
  });
});
