import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../catalogue/from-pandc";
import { AACOM_2027 } from "../../data/aacom-2027";
import { EXAMPLE_PLAN } from "../../data/example-plan";
import { parseRequisites } from "./requisites";
import type { Catalogue, CatalogueCourse } from "./types";
import {
  activeGroups,
  allocate,
  activeEligibleLeaves,
  eligibleLeaves,
  IneligiblePinError,
  type AllocGroup,
  type AllocItem,
} from "./allocation";

function loadRealCatalogue(): Catalogue {
  const files = readdirSync("data/2027/courses").filter((f) => f.endsWith(".json"));
  const courses = new Map<string, CatalogueCourse>();
  const all: CatalogueCourse[] = [];
  for (const file of files) {
    const json: PandcCourseJson = JSON.parse(readFileSync(`data/2027/courses/${file}`, "utf-8"));
    if (!isUndergrad(json.code)) continue;
    const course = fromPandc(json, null, parseRequisites);
    all.push(course);
    courses.set(course.code, course);
  }
  let horizonYear = 0;
  for (const c of all) for (const o of c.offerings) if (o.year > horizonYear) horizonYear = o.year;
  return { courses, horizonYear };
}

const cat = loadRealCatalogue();

function itemFor(code: string, choices: Record<string, string>, pinned: string | null = null): AllocItem {
  const course = cat.courses.get(code);
  if (!course) throw new Error(`fixture missing course ${code}`);
  // A two-semester course's `units` is its per-semester amount (e.g.
  // COMP4550 is "12+12", scraped as units:12); it contributes double that
  // toward requirements, matching evaluate.ts's per-term termUnits sum.
  const units = course.twoSemester ? course.units * 2 : course.units;
  return {
    code,
    units,
    eligible: eligibleLeaves(AACOM_2027, choices, course, null),
    pinned,
  };
}

describe("activeGroups / eligibleLeaves (real AACOM 2027 data)", () => {
  it("an unchosen selectable group contributes no active groups for its children", () => {
    const groups = activeGroups(AACOM_2027, {});
    const ids = new Set(groups.map((g) => g.id));
    expect(ids.has("spec")).toBe(true);
    expect(ids.has("arin")).toBe(false);
    expect(ids.has("arin-a")).toBe(false);
    expect(ids.has("capstone")).toBe(true);
    expect(ids.has("cap-research")).toBe(false);
  });

  it("a chosen selectable group activates only that child's subtree", () => {
    const groups = activeGroups(AACOM_2027, { spec: "arin", capstone: "cap-research" });
    const ids = new Set(groups.map((g) => g.id));
    expect(ids.has("arin")).toBe(true);
    expect(ids.has("arin-a")).toBe(true);
    expect(ids.has("arin-b")).toBe(true);
    expect(ids.has("hccc")).toBe(false);
    expect(ids.has("cap-research")).toBe(true);
    expect(ids.has("cap-team")).toBe(false);
  });

  it("eligibleLeaves with {} lists eligible leaves across every specialisation option", () => {
    const course = cat.courses.get("COMP2620")!; // arin-a and thcs-a
    const leaves = eligibleLeaves(AACOM_2027, {}, course, null);
    expect(leaves).toContain("arin-a");
    expect(leaves).toContain("thcs-a");
  });

  // What a placed course can actually count toward (and be pinned to): a
  // selectable group with no choice yet contributes nothing, as in
  // activeGroups — not every option's leaves, as eligibleLeaves({}) does.
  it("activeEligibleLeaves skips an unchosen selectable group's options", () => {
    const course = cat.courses.get("COMP4500")!;
    const unchosen = activeEligibleLeaves(AACOM_2027, {}, course, null);
    expect(unchosen.filter((id) => id.startsWith("cap-"))).toEqual([]);
    const team = activeEligibleLeaves(AACOM_2027, { capstone: "cap-team" }, course, null);
    expect(team).toContain("cap-team-proj");
    expect(team).not.toContain("cap-intern-4k");
  });

  it("eligibleLeaves with a real choice restricts to the chosen branch", () => {
    const course = cat.courses.get("COMP2620")!;
    const leaves = eligibleLeaves(AACOM_2027, { spec: "arin" }, course, null);
    expect(leaves).toContain("arin-a");
    expect(leaves).not.toContain("thcs-a");
  });
});

describe("allocate: synthetic graphs", () => {
  it("minimums before surplus: both leaves end up satisfied", () => {
    const groups: AllocGroup[] = [
      { id: "A", parentId: null, order: 0, unitsRequired: 6, unitsMax: null },
      { id: "B", parentId: null, order: 1, unitsRequired: 6, unitsMax: null },
    ];
    const items: AllocItem[] = [
      { code: "AB", units: 6, eligible: ["A", "B"], pinned: null },
      { code: "AONLY", units: 6, eligible: ["A"], pinned: null },
    ];
    const result = allocate(groups, items);
    expect(result.unitsByGroup.A).toBe(6);
    expect(result.unitsByGroup.B).toBe(6);
    expect(result.byCourse.AONLY).toBe("A");
    expect(result.byCourse.AB).toBe("B");
  });

  it("pinning to an ineligible group throws IneligiblePinError", () => {
    const groups: AllocGroup[] = [{ id: "A", parentId: null, order: 0, unitsRequired: 6, unitsMax: null }];
    const items: AllocItem[] = [{ code: "X", units: 6, eligible: ["A"], pinned: "B" }];
    expect(() => allocate(groups, items)).toThrow(IneligiblePinError);
  });

  it("deterministic: the same input gives the same output", () => {
    const groups: AllocGroup[] = [
      { id: "A", parentId: null, order: 0, unitsRequired: 6, unitsMax: null },
      { id: "B", parentId: null, order: 1, unitsRequired: 12, unitsMax: null },
    ];
    const items: AllocItem[] = [
      { code: "X", units: 6, eligible: ["A", "B"], pinned: null },
      { code: "Y", units: 6, eligible: ["A", "B"], pinned: null },
      { code: "Z", units: 6, eligible: ["B"], pinned: null },
    ];
    const first = allocate(groups, items);
    const second = allocate(groups, items);
    expect(second).toEqual(first);
  });
});

describe("allocate: real AACOM 2027 data", () => {
  it("unitsMax caps a leaf and overflow goes elsewhere: arin-a gets exactly 12, the rest go to comp-upper/electives", () => {
    const choices = { spec: "arin", capstone: "cap-research" };
    const codes = ["COMP2620", "COMP3242", "COMP3620", "COMP3670"];
    const groups = activeGroups(AACOM_2027, choices);
    const items = codes.map((code) => itemFor(code, choices));
    const result = allocate(groups, items);
    expect(result.unitsByGroup["arin-a"]).toBe(12);
    for (const code of codes) {
      const group = result.byCourse[code];
      expect(group === "arin-a" || group === "comp-upper" || group === "electives").toBe(true);
    }
    const inArinA = codes.filter((code) => result.byCourse[code] === "arin-a");
    expect(inArinA).toHaveLength(2);
  });

  it("MATH1013 goes where it's needed: MATH1005 to math-disc, MATH1013 to ict", () => {
    const choices = { spec: "arin", capstone: "cap-research" };
    const groups = activeGroups(AACOM_2027, choices);
    const items = [itemFor("MATH1005", choices), itemFor("MATH1013", choices)];
    const result = allocate(groups, items);
    expect(result.byCourse.MATH1005).toBe("math-disc");
    expect(result.byCourse.MATH1013).toBe("ict");
  });

  it("pins are respected: MATH1013 pinned to electives goes there, leaving ict unmet", () => {
    const choices = { spec: "arin", capstone: "cap-research" };
    const groups = activeGroups(AACOM_2027, choices);
    const items = [itemFor("MATH1013", choices, "electives")];
    const result = allocate(groups, items);
    expect(result.byCourse.MATH1013).toBe("electives");
    expect(result.unitsByGroup.ict ?? 0).toBe(0);
  });

  it("pinning to an ineligible group throws IneligiblePinError (real course)", () => {
    const choices = { spec: "arin", capstone: "cap-research" };
    const groups = activeGroups(AACOM_2027, choices);
    const item = itemFor("MATH1013", choices, "math-disc");
    expect(() => allocate(groups, [item])).toThrow(IneligiblePinError);
  });

  it("courses are never split: COMP4550 (24 units, two-semester) is allocated wholly to cap-research", () => {
    const choices = { spec: "arin", capstone: "cap-research" };
    const groups = activeGroups(AACOM_2027, choices);
    const items = [itemFor("COMP4550", choices)];
    const result = allocate(groups, items);
    expect(result.byCourse.COMP4550).toBe("cap-research");
    expect(result.unitsByGroup["cap-research"]).toBe(24);
  });

  it("an unchosen selectable group gets nothing and is unsatisfied", () => {
    const choices = { capstone: "cap-research" }; // spec deliberately unchosen
    const groups = activeGroups(AACOM_2027, choices);
    const items = [itemFor("COMP2620", choices)]; // would match arin-a or thcs-a, both inactive
    const result = allocate(groups, items);
    expect(result.byCourse.COMP2620).not.toBe("arin-a");
    expect(result.unitsByGroup.spec ?? 0).toBe(0);
  });

  it("a compulsory COMP3630 in THCS stays compulsory: compulsory is satisfied, thcs-a doesn't also count it", () => {
    const choices = { spec: "thcs", capstone: "cap-research" };
    const groups = activeGroups(AACOM_2027, choices);
    const compulsoryCodes = ["COMP2100", "COMP2120", "COMP2300", "COMP2310", "COMP2400", "COMP3600", "COMP3630", "COMP4450"];
    const items = compulsoryCodes.map((code) => itemFor(code, choices));
    const result = allocate(groups, items);
    expect(result.byCourse.COMP3630).toBe("compulsory");
    expect(result.unitsByGroup.compulsory).toBe(48);
  });

  it("deterministic over the example plan's allocation", () => {
    const choices = EXAMPLE_PLAN.choices;
    const groups = activeGroups(AACOM_2027, choices);
    const items = EXAMPLE_PLAN.placements.map((p) => itemFor(p.code, choices));
    const first = allocate(groups, items);
    const second = allocate(groups, items);
    expect(second).toEqual(first);
  });

  it("performance: allocating the example plan takes under 50ms (median of 5 runs)", () => {
    const choices = EXAMPLE_PLAN.choices;
    const groups = activeGroups(AACOM_2027, choices);
    const items = EXAMPLE_PLAN.placements.map((p) => itemFor(p.code, choices));
    const durations: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      allocate(groups, items);
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    expect(durations[2]).toBeLessThan(50);
  });
});
