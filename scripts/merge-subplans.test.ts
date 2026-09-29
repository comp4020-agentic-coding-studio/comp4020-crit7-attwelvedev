import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ScrapedSubplan, SupplementEntry } from "../src/data/specialisation-types.ts";
import { mergeAll, mergeSubplan, readInputs } from "./merge-subplans.ts";

function scraped(over: Partial<ScrapedSubplan> = {}): ScrapedSubplan {
  return {
    kind: "subplan",
    year: "2027",
    scraped_at: "2026-09-26T07:04:53Z",
    code: "TEST-SPEC",
    url: "https://example.test/TEST-SPEC",
    title: "Test",
    min_units: 24,
    introduction: "Intro.",
    learning_outcomes: ["Learn."],
    requirements: [],
    specialisations: [],
    all_course_codes: [],
    ...over,
  };
}

const extra: SupplementEntry = { otherInformation: ["Other."], relevantDegrees: ["A (AACOM)", "B (AACRD)"] };

describe("mergeSubplan", () => {
  it("splits the introduction into trimmed paragraphs", () => {
    const merged = mergeSubplan(scraped({ introduction: "A\n\nB\n\n\nC" }), extra);
    expect(merged.introduction).toEqual(["A", "B", "C"]);
  });

  it("maps groups to lists, AND to and, listed headings to headings and the rest to text, in order", () => {
    const merged = mergeSubplan(
      scraped({
        requirements: [
          { type: "text", content: "Advice" },
          { type: "text", content: "Rule." },
          { type: "group", heading: "Take:", courses: [{ code: "COMP1100", title: "x", units: null }] },
          { type: "text", content: "AND" },
          { type: "group", heading: "Then:", courses: [{ code: "COMP1110", title: "y", units: 6 }] },
        ],
      }),
      { ...extra, headings: ["Advice"] },
    );
    expect(merged.requirements).toEqual([
      { type: "heading", content: "Advice" },
      { type: "text", content: "Rule." },
      { type: "list", heading: "Take:", courses: ["COMP1100"] },
      { type: "and" },
      { type: "list", heading: "Then:", courses: ["COMP1110"] },
    ]);
  });

  it("throws when a supplement heading matches no scraped text", () => {
    expect(() =>
      mergeSubplan(scraped({ requirements: [{ type: "text", content: "Rule." }] }), { ...extra, headings: ["Gone"] }),
    ).toThrow(/TEST-SPEC/);
  });
});

describe("mergeAll", () => {
  const supplement = (codes: string[]) => ({
    source: "test",
    specialisations: Object.fromEntries(codes.map((c) => [c, extra])),
  });

  it("throws on a scraped code with no supplement entry", () => {
    expect(() => mergeAll([scraped({ code: "A-SPEC" })], supplement([]))).toThrow(/A-SPEC/);
  });

  it("throws on a supplement code that wasn't scraped", () => {
    expect(() => mergeAll([], supplement(["B-SPEC"]))).toThrow(/B-SPEC/);
  });

  it("sorts by code", () => {
    const file = mergeAll([scraped({ code: "B-SPEC" }), scraped({ code: "A-SPEC" })], supplement(["A-SPEC", "B-SPEC"]));
    expect(file.specialisations.map((s) => s.code)).toEqual(["A-SPEC", "B-SPEC"]);
  });
});

describe("data/2027/specialisations.json", () => {
  const merge = () => {
    const { scraped: inputs, supplement } = readInputs();
    return mergeAll(inputs, supplement);
  };

  it("is fresh", () => {
    const file = merge();
    const committed = JSON.parse(readFileSync("data/2027/specialisations.json", "utf8"));
    expect(committed, "stale: run node scripts/merge-subplans.ts").toEqual(file);
  });

  it("restores what the scrape lost", () => {
    const file = merge();
    const byCode = Object.fromEntries(file.specialisations.map((s) => [s.code, s]));
    expect(byCode["SYAR-SPEC"].topics).toHaveLength(13);
    expect(byCode["HCCC-SPEC"].requirements).toContainEqual({ type: "heading", content: "Advice to Students" });
    for (const s of file.specialisations) {
      expect(s.otherInformation.length, s.code).toBeGreaterThanOrEqual(1);
      expect(s.relevantDegrees, s.code).toHaveLength(2);
      expect(s.relevantDegrees.some((d) => d.includes("(AACOM)")), s.code).toBe(true);
      expect(s.relevantDegrees.some((d) => d.includes("(AACRD)")), s.code).toBe(true);
      expect(s.requirements, s.code).not.toContainEqual({ type: "text", content: "AND" });
    }
  });
});
