import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs a file's tests one after another and only runs files in
// parallel, so the slowest browser file sets pnpm check's wall time. As one
// 4,300-line file the browser suite took ~7 minutes; split by area
// (spec/layout/<area>.test.ts) it takes ~1. A browser test costs ~1.2s
// (median), so this many lines is roughly 80s — past it, split the file
// by area instead of letting the whole check slow down again.
const MAX_BROWSER_FILE_LINES = 1000;

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("spec suite size", () => {
  it(`keeps every browser spec file under ${MAX_BROWSER_FILE_LINES} lines, so files run in parallel`, () => {
    const oversized = testFiles("spec")
      .map((path) => ({ path, source: readFileSync(path, "utf-8") }))
      .filter(({ source }) => /\buseBrowser\(\)|\blaunch\(\)/.test(source))
      .map(({ path, source }) => ({ path, lines: source.split("\n").length }))
      .filter(({ lines }) => lines > MAX_BROWSER_FILE_LINES)
      .map(({ path, lines }) => `${path}: ${lines} lines — split it by area (see spec/README.md)`);
    expect(oversized).toEqual([]);
  });
});
