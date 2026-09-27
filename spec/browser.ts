import { type Browser, chromium, type Page } from "playwright";

// Headless Chromium for the checks jsdom can't make: anything that depends on
// real layout (overflow, widths, which pane sits beside which) only exists
// once a browser has actually rendered the page.

export interface Viewport {
  width: number;
  height: number;
}

export interface OpenOptions {
  storage?: Record<string, string>; // seeded into localStorage before any page script
  blockScripts?: boolean; // aborts /_astro/*.js (islands + bundled scripts); inline scripts still run
}

export async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (error) {
    throw new Error("Chromium not installed — run `pnpm exec playwright install chromium`", { cause: error });
  }
}

export async function openPage(
  browser: Browser,
  url: string,
  viewport: Viewport,
  options: OpenOptions = {},
): Promise<Page> {
  const context = await browser.newContext({ viewport });
  if (options.storage) {
    await context.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, options.storage);
  }
  if (options.blockScripts) {
    await context.route(/\/_astro\/.*\.js$/, (route) => route.abort());
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export function verticalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
}

// The same rules the jsdom invariants disable, so the two runs agree on what
// counts as a violation; this one just sees the page after real rendering.
export async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: (await import("axe-core")).default.source });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const results = await axe.run(document, {
      rules: {
        "color-contrast": { enabled: false },
        "link-in-text-block": { enabled: false },
      },
    });
    return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join("; ")}`);
  });
}
