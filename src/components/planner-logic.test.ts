import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { dropTargets, progressSegments } from "./planner-logic";

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

function emptyPlan(): PlanState {
  return { id: "p", readOnly: false, cutoff: 0, choices: {}, placements: [] };
}

describe("dropTargets", () => {
  it("matches courses[code].hardBlocked for each of the 8 terms", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const targets = dropTargets(view, "COMP3630");
    const hardBlocked = view.courses.COMP3630.hardBlocked;

    expect(targets).toHaveLength(8);
    for (const target of targets) {
      const reason = hardBlocked[target.term] ?? null;
      expect(target.reason).toBe(reason);
      expect(target.allowed).toBe(reason === null);
    }
    expect(targets[0].allowed).toBe(false);
    expect(targets[0].reason).toBeTruthy();
  });

  it("readOnly disables every target", () => {
    const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), readOnly: true });
    const targets = dropTargets(view, "COMP1130");
    expect(targets.every((t) => t.allowed === false)).toBe(true);
    expect(targets.every((t) => typeof t.reason === "string")).toBe(true);
  });
});

describe("progressSegments", () => {
  it("returns percentages clamped to 100 in total", () => {
    const under = progressSegments(6, 6, 24);
    expect(under.completedPct + under.plannedPct).toBeLessThanOrEqual(100);
    expect(under.completedPct).toBeCloseTo(25);
    expect(under.plannedPct).toBeCloseTo(25);

    const over = progressSegments(18, 18, 24);
    expect(over.completedPct + over.plannedPct).toBeLessThanOrEqual(100);
    expect(over.completedPct).toBeCloseTo(75);
    expect(over.plannedPct).toBeCloseTo(25);
  });

  it("handles a zero-required check without dividing by zero", () => {
    const result = progressSegments(0, 0, 0);
    expect(result.completedPct).toBe(0);
    expect(result.plannedPct).toBe(0);
  });
});
