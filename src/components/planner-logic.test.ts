import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { dropTargets, outstandingItems, overlayEdges, progressSegments, unplacedCount } from "./planner-logic";

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

  it("uses a given hardBlockedOverride instead of view.courses[code] — for a search result not (yet) in the plan's tree", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    // PSYC1004 isn't in the AACOM tree, so it isn't in view.courses at all;
    // dropTargets must not silently treat that as "every term allowed".
    expect(view.courses.PSYC1004).toBeUndefined();
    const targets = dropTargets(view, "PSYC1004", { 0: "not offered in S1 2027" });
    expect(targets[0]).toEqual({ term: 0, allowed: false, reason: "not offered in S1 2027" });
    expect(targets[1]).toEqual({ term: 1, allowed: true, reason: null });
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

describe("overlayEdges", () => {
  it("returns an edge only for a prereq placed in an earlier term", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [
        { code: "COMP1140", term: 1, pinnedGroupId: null },
        { code: "COMP2100", term: 2, pinnedGroupId: null },
      ],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    const edges = overlayEdges(view, "COMP2100");
    expect(edges).toContainEqual({ from: "COMP1140", to: "COMP2100" });
    expect(edges.some((e) => e.from === "COMP1110")).toBe(false);
  });

  it("excludes a prereq placed in the same or a later term unless concurrent", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [
        { code: "COMP1140", term: 2, pinnedGroupId: null },
        { code: "COMP2100", term: 2, pinnedGroupId: null },
      ],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(overlayEdges(view, "COMP2100")).toEqual([]);
  });

  it("returns nothing for an unplaced course", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(overlayEdges(view, "COMP2100")).toEqual([]);
  });
});

describe("unplacedCount", () => {
  it("counts COMP2100's unplaced prereqs when it's placed alone", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [{ code: "COMP2100", term: 2, pinnedGroupId: null }],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(unplacedCount(view, "COMP2100")).toBe(view.placements[0].unplacedPrereqs.length);
    expect(unplacedCount(view, "COMP2100")).toBeGreaterThan(0);
  });

  it("is 0 for a course that isn't placed", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(unplacedCount(view, "COMP2100")).toBe(0);
  });
});

describe("outstandingItems", () => {
  it("gives an unsatisfied leaf group's unit shortfall, not its missing courses", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const items = outstandingItems(view);
    const progItem = items.find((i) => i.id === "group-prog-a");
    // "needs COMP1100, COMP1130" would read as "you need both", when
    // placing either one alone (6 of the 6 required units) satisfies it —
    // naming specific courses overclaims for anything but an ALL-rule group.
    expect(progItem?.text).toBe("Programming as Problem Solving: 6 more units needed");
    expect(progItem?.text).not.toContain("COMP1100");
  });

  it("drops a group once it's satisfied", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [{ code: "COMP1100", term: 0, pinnedGroupId: null }],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(view.groups.some((g) => g.id === "prog-a" && g.satisfied)).toBe(true);
    expect(outstandingItems(view).some((i) => i.id === "group-prog-a")).toBe(false);
  });

  it("flags a selectable group with no choice made yet", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(outstandingItems(view)).toContainEqual({ id: "choice-spec", text: "Choose your Specialisation" });
  });

  it("drops the choice item once one is made", () => {
    const plan: PlanState = { ...emptyPlan(), choices: { spec: "arin" } };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(outstandingItems(view).some((i) => i.id === "choice-spec")).toBe(false);
  });

  it("gives a filter-based group (no fixed course list at all) the same unit-shortfall treatment", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const electives = outstandingItems(view).find((i) => i.id === "group-electives");
    expect(electives?.text).toMatch(/\d+ more units? needed/);
  });

  it("reports a failing check as not yet satisfied, and an untracked one separately", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const items = outstandingItems(view);
    expect(items).toContainEqual({
      id: "check-comp4000-min",
      text: "At least 48 units of 4000-level COMP: not yet satisfied",
    });
    expect(items).toContainEqual({
      id: "check-tdp-min",
      text: "At least 12 units of TDP-tagged courses — not tracked, verify on P&C",
    });
  });
});
