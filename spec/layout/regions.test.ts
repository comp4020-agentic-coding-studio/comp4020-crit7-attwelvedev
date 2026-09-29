import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { openPage, type Viewport } from "../browser";
import { baseUrl, browser, openSearch, planWithPlacement, useBrowser } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };

// The only layers allowed frosted glass (WR22): things that float over the
// workspace. Later phases' layers are listed ahead of time, so glass added
// anywhere else fails here rather than in a review.
const GLASS_ALLOWLIST = [
  ".timeline-glass",
  ".timeline-toolbar",
  ".details-head",
  ".palette",
  ".undo-toast",
  ".drag-ghost",
  ".size-tip",
  ".tabbar",
  ".sheet-head",
];

async function onPlan(path: string, viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
  const page = await openPage(browser, new URL(path, baseUrl).href, viewport);
  try {
    await check(page);
  } finally {
    await page.close();
  }
}

// A custom property's value as the browser resolves it to a colour, so it
// compares equal to a computed background.
function resolvedColour(page: Page, token: string): Promise<string> {
  return page.evaluate((token) => {
    const probe = document.createElement("div");
    probe.style.background = `var(${token})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, token);
}

// styles.css as a flat list of rules, each with the at-rule conditions
// around it. Enough of a parser for this one hand-written file: comments
// stripped, braces matched, no strings containing braces.
interface CssRule {
  selector: string;
  conditions: string[];
  body: string;
}

function cssRules(source: string): CssRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      const prelude = text.slice(start, i).trim();
      const close = matchingBrace(text, i);
      const inner = text.slice(i + 1, close);
      if (inner.includes("{")) {
        rules.push(...cssRules(inner).map((r) => ({ ...r, conditions: [prelude, ...r.conditions] })));
      } else {
        rules.push({ selector: prelude, conditions: [], body: inner });
      }
      i = close;
      start = close + 1;
    } else if (text[i] === ";" && !text.slice(start, i).includes("{")) {
      start = i + 1; // a top-level statement such as @import
    }
  }
  return rules;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  throw new Error("unbalanced braces in styles.css");
}

const REDUCED_TRANSPARENCY = /@media\s*\(\s*prefers-reduced-transparency\s*:\s*reduce\s*\)/;
const BACKDROP = /(?<![\w-])(?:-webkit-)?backdrop-filter\s*:\s*([^;]+)/g;

describe("regions and glass", { timeout: 30_000 }, () => {
  it("regions are rounded surfaces on the ground", async () => {
    await onPlan("/plan/example?course=COMP2100", desktop, async (page) => {
      await page.locator(".details-panel").waitFor();
      const surface = await resolvedColour(page, "--surface");
      const ground = await resolvedColour(page, "--ground");
      expect(ground).not.toBe(surface);
      const regions = await page.evaluate(() =>
        ["aside#requirements", ".planner-timeline-area", ".details-panel"].map((selector) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return { selector, radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundColor };
        }),
      );
      for (const region of regions) {
        expect(region.radius, region.selector).toBeGreaterThanOrEqual(14);
        expect(region.background, region.selector).toBe(surface);
      }
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(ground);
    });
  });

  it("glass only on the allowlist", async () => {
    const id = await planWithPlacement("COMP1100");
    await onPlan(`/plan/${id}?course=COMP2100`, desktop, async (page) => {
      await page.locator(".details-panel").waitFor();
      await openSearch(page);
      const frosted = await page.evaluate((allowlist) => {
        const found: { el: string; allowed: boolean }[] = [];
        for (const el of document.querySelectorAll("*")) {
          for (const pseudo of [null, "::before", "::after"]) {
            if (getComputedStyle(el, pseudo).backdropFilter === "none") continue;
            found.push({
              el: `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}${pseudo ?? ""}`,
              allowed: pseudo === null && el.matches(allowlist),
            });
          }
        }
        return found;
      }, GLASS_ALLOWLIST.join(", "));
      expect(frosted.filter((f) => !f.allowed).map((f) => f.el)).toEqual([]);
      // Not vacuous: the layers open here really are frosted.
      const names = frosted.map((f) => f.el).join(" ");
      expect(names).toContain(".details-head");
      expect(names).toContain(".palette");
    });
  });

  // Playwright can't emulate prefers-reduced-transparency, so this reads
  // the stylesheet instead of the render.
  it("reduced transparency removes glass", () => {
    const rules = cssRules(readFileSync("src/styles.css", "utf-8"));
    const reduced = rules.filter((r) => r.conditions.some((c) => REDUCED_TRANSPARENCY.test(c)));
    const glassFallback = reduced.find((r) => r.selector.split(",").some((s) => s.trim() === ".glass"));
    expect(glassFallback, "a .glass rule under prefers-reduced-transparency: reduce").toBeDefined();
    expect(glassFallback!.body).toMatch(/(?<![\w-])backdrop-filter\s*:\s*none/);
    expect(glassFallback!.body).toMatch(/background\s*:\s*var\(--surface\)/);

    const allowed = [".glass", ...GLASS_ALLOWLIST];
    const stray = rules
      .filter((r) => !r.conditions.some((c) => REDUCED_TRANSPARENCY.test(c)))
      .filter((r) => [...r.body.matchAll(BACKDROP)].some((m) => m[1].trim() !== "none"))
      .filter((r) =>
        r.selector
          .split(",")
          .map((s) => s.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? "")
          .some((subject) => !allowed.some((a) => new RegExp(`${a.replace(".", "\\.")}(?![\\w-])`).test(subject))),
      )
      .map((r) => r.selector);
    expect(stray).toEqual([]);
  });

  // A classic 15px bar with a square track ran over the regions' rounded
  // corners (Task 13 review, 2026-09-29). Their scrollbars are thin, on a
  // clear track whose margin keeps the thumb's ends off the corners, like
  // the mockup's. Playwright's headless Chromium hides scrollbars
  // (--hide-scrollbars), so only the aside's reserved gutter has a size to
  // measure; for the rest this reads the styles the bar is drawn with.
  it("regions' scrollbars are thin, with a clear track held off the corners", async () => {
    await onPlan("/plan/example?course=COMP2100", desktop, async (page) => {
      await page.locator(".details-panel").waitFor();
      const bars = await page.evaluate(() =>
        ["aside#requirements", ".details-panel", ".timeline-scroll", ".planner-timeline-area"].map((selector) => {
          const el = document.querySelector<HTMLElement>(selector)!;
          const bar = getComputedStyle(el, "::-webkit-scrollbar");
          const track = getComputedStyle(el, "::-webkit-scrollbar-track");
          const thumb = getComputedStyle(el, "::-webkit-scrollbar-thumb");
          return {
            selector,
            width: parseFloat(bar.width),
            height: parseFloat(bar.height),
            track: track.backgroundColor,
            trackMargin: parseFloat(track.marginTop),
            thumbRadius: parseFloat(thumb.borderTopLeftRadius),
          };
        }),
      );
      for (const bar of bars) {
        expect(bar.width, bar.selector).toBeLessThanOrEqual(10);
        expect(bar.height, bar.selector).toBeLessThanOrEqual(10);
        expect(bar.track, bar.selector).toBe("rgba(0, 0, 0, 0)");
        expect(bar.trackMargin, bar.selector).toBeGreaterThanOrEqual(8);
        expect(bar.thumbRadius, bar.selector).toBeGreaterThan(0);
      }
      const gutter = await page.evaluate(() => {
        const aside = document.querySelector<HTMLElement>("aside#requirements")!;
        return aside.offsetWidth - aside.clientWidth - 2 * parseFloat(getComputedStyle(aside).borderLeftWidth);
      });
      expect(gutter).toBeGreaterThan(0);
      expect(gutter).toBeLessThanOrEqual(10);
    });
  });

  // A local background (what the sticky head's glass frosts: without it the
  // site nav bled through on a phone) doesn't reach the scrollbar, which
  // sits outside the scrolling content, so the clear track showed the
  // ground behind the panel (Task 15 review, 2026-09-29). The scrollbar
  // paints the panel's white itself. Headless Chromium draws no
  // scrollbars, so this reads the styles rather than the pixels.
  it("the details panel's scrollbar track shows the panel's own white", async () => {
    await onPlan("/plan/example?course=COMP2100", desktop, async (page) => {
      await page.locator(".details-panel").waitFor();
      const surface = await resolvedColour(page, "--surface");
      const styles = await page.locator(".details-panel").evaluate((el) => ({
        panel: getComputedStyle(el).backgroundColor,
        attachment: getComputedStyle(el).backgroundAttachment,
        bar: getComputedStyle(el, "::-webkit-scrollbar").backgroundColor,
      }));
      expect(styles).toEqual({ panel: surface, attachment: "local", bar: surface });
    });
  });

  it("cards keep a smaller radius than regions", async () => {
    await onPlan("/plan/example", desktop, async (page) => {
      const radii = await page.evaluate(() => {
        const radius = (s: string) => parseFloat(getComputedStyle(document.querySelector(s)!).borderTopLeftRadius);
        return { card: radius(".course-card"), region: radius("aside#requirements") };
      });
      expect(radii.card).toBeGreaterThan(0);
      expect(radii.card).toBeLessThan(radii.region);
    });
  });
});

// Figures (units, weights, class numbers, dates) line up because every
// element draws its digits tabular, from one rule — not a monospaced face
// (Phase 05 review ruling, 2026-09-29). The page title is the exception:
// its digits are part of a name, not a figure.
describe("figures", { timeout: 30_000 }, () => {
  it("every figure on the plan page, details open, uses tabular numerals", async () => {
    await onPlan("/plan/example?course=COMP2100", desktop, async (page) => {
      await page.locator(".details-panel").waitFor();
      const proportional = await page.evaluate(() =>
        [...document.querySelectorAll("body *:not(h1, script, style, noscript)")]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && /\d/.test(n.textContent ?? "")))
          .filter((el) => !getComputedStyle(el).fontVariantNumeric.includes("tabular-nums"))
          .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`),
      );
      expect(proportional).toEqual([]);
    });
  });
});
