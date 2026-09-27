import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRequisites } from "./requisites";
import type { ReqExpr } from "./types";
import { verifyItemLabels } from "./verify-labels";

function parse(code: string) {
  const raw = JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8"));
  return parseRequisites({ prerequisites: raw.prerequisites, incompatibilities: raw.incompatibilities });
}

describe("verifyItemLabels", () => {
  it("an item AND'ed with exactly one course is labelled with it", () => {
    const { prereq, unverifiable } = parse("MATH1116");
    const labels = verifyItemLabels(prereq, unverifiable);
    expect(labels.get("with a mark of 60 or above")).toBe("MATH1115 with a mark of 60 or above");
    expect(labels.get("with a mark of 80 or above")).toBe("MATH1113 with a mark of 80 or above");
  });

  it("other items keep their text", () => {
    const { prereq, unverifiable } = parse("COMP4550");
    const labels = verifyItemLabels(prereq, unverifiable);
    expect(unverifiable.length).toBeGreaterThan(0);
    for (const item of unverifiable) expect(labels.get(item)).toBe(item);
  });

  it("an item AND'ed with two courses keeps its text", () => {
    const prereq: ReqExpr = {
      kind: "and",
      items: [
        { kind: "course", code: "ZZDD1000", concurrent: false },
        { kind: "course", code: "ZZDD1001", concurrent: false },
        { kind: "unverifiable", text: "x" },
      ],
    };
    expect(verifyItemLabels(prereq, ["x"]).get("x")).toBe("x");
  });

  // A whole-sentence AND can hold one course too — COMP4820's is
  // AND(program, COMP2100, units, "Competitive entry ...", ...) — but its
  // items have nothing to do with that course: "COMP2100 Competitive entry"
  // would misread the requirement.
  it.each(["COMP4820", "COMP4020"])("%s: an item in a sentence-level AND with one course keeps its text", (code) => {
    const { prereq, unverifiable } = parse(code);
    const labels = verifyItemLabels(prereq, unverifiable);
    expect(unverifiable.length).toBeGreaterThan(0);
    for (const item of unverifiable) expect(labels.get(item)).toBe(item);
  });
});
